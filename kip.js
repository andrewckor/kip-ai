import { GoogleGenerativeAI } from '@google/generative-ai';
import html2canvas from 'html2canvas';
import { config } from './config.js';
import { chatStyles } from './includes/styles.js';
import { CURSOR_IMAGE } from './includes/cursor-image.js';
import { cursorStyles } from './includes/cursor-styles.js';

// Initialize Gemini with function calling
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
const userInteractions = [];
let shouldKipObserveInteractions = false;
let chat;
let chatElements = null;

// Define available functions for Gemini
const functionDefinitions = [
  {
    name: 'highlightPageElement',
    description: 'Highlight an element on the page to guide the user where to click or interact',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description:
            "The CSS selector or ID of the element to highlight (e.g., '#email' or '.submit-button')",
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'removeActiveHighlight',
    description: 'Remove any active highlight from the page when the user moved to next step',
    parameters: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'The selector parameter is ignored but required by the API for consistency',
        },
      },
      required: ['selector'],
    },
  },
];

// Function implementation
function createFloatingCursor(x, y) {
  // Remove any existing floating cursor
  const existingCursor = document.querySelector('#cursor');
  if (existingCursor) {
    existingCursor.remove();
  }

  // Create the floating cursor element
  const cursor = document.createElement('div');
  cursor.innerHTML = CURSOR_IMAGE;

  // Position the cursor
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;
  cursor.style.position = `fixed`;

  // Add to document
  document.body.appendChild(cursor);

  return cursor;
}

// Keep track of currently highlighted element
let currentlyHighlightedElement = null;

function removeActiveHighlight() {
  // Remove cursor
  const cursor = document.querySelector('.floating-hand');
  if (cursor) {
    cursor.remove();
  }

  // Remove highlight from current element
  if (currentlyHighlightedElement) {
    currentlyHighlightedElement.style.backgroundColor = '';
    currentlyHighlightedElement.style.outline = '';
    currentlyHighlightedElement.style.transition = '';
    currentlyHighlightedElement = null;
  }

  shouldKipObserveInteractions = false;
  return 'Highlight and cursor removed';
}

function highlightPageElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
    // Remove any existing highlight first
    removeActiveHighlight();

    const rect = element.getBoundingClientRect();
    const coordinates = {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      element: selector,
    };

    // Highlight the element
    element.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
    element.style.outline = '2px solid red';
    element.style.transition = 'all 0.3s ease-in-out';
    currentlyHighlightedElement = element;

    // Only scroll if element is not in viewport
    const elementRect = element.getBoundingClientRect();
    const isInViewport =
      elementRect.top >= 0 &&
      elementRect.left >= 0 &&
      elementRect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      elementRect.right <= (window.innerWidth || document.documentElement.clientWidth);

    if (!isInViewport) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Create floating cursor below the element
    const cursorX = rect.left + window.scrollX + rect.width / 2 - 16; // Center horizontally
    const cursorY = rect.bottom + window.scrollY + 10; // 10px below the element
    createFloatingCursor(cursorX, cursorY);

    shouldKipObserveInteractions = true;
    return JSON.stringify(coordinates, null, 2);
  }
  return `Element with selector "${selector}" not found`;
}

// Create and append chat container
const createChatContainer = () => {
  // Create the pill button
  const pillButton = document.createElement('div');
  pillButton.id = 'chat-pill';
  pillButton.innerHTML = 'Chat with Kip';
  pillButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #007bff;
    color: white;
    padding: 12px 24px;
    border-radius: 25px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 1000;
    transition: all 0.3s ease;
  `;

  // Create the chat container
  const chatContainer = document.createElement('div');
  chatContainer.innerHTML = `
    <div id="chat-container" style="${chatStyles.chatContainer} display: none; position: fixed; bottom: 80px; right: 20px; width: 350px; height: 500px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); border-radius: 10px; overflow: hidden;">
      <div id="chat-messages" style="${chatStyles.chatMessages}"></div>
      <div id="chat-input-container" style="${chatStyles.chatInputContainer}">
        <input 
          type="text"
          id="chat-input"
          placeholder="Type your message..."
          value="How do I send my resume?"
          style="${chatStyles.chatInput}"
        />
        <button 
          id="send-button" 
          style="${chatStyles.sendButton}"
          onmouseover="this.style.background='#0056b3'" 
          onmouseout="this.style.background='#007bff'"
        >Send</button>
      </div>
    </div>
  `;

  // Add elements to the page
  document.body.appendChild(pillButton);
  document.body.appendChild(chatContainer.firstElementChild);

  // Store references to chat elements
  chatElements = {
    container: document.getElementById('chat-container'),
    messages: document.getElementById('chat-messages'),
    input: document.getElementById('chat-input'),
    sendButton: document.getElementById('send-button'),
    pill: pillButton,
  };

  // Set up event listeners
  chatElements.sendButton.addEventListener('click', handleSendMessage);
  chatElements.input.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });

  // Add toggle functionality
  let isChatOpen = false;
  chatElements.pill.addEventListener('click', () => {
    isChatOpen = !isChatOpen;
    chatElements.container.style.display = isChatOpen ? 'flex' : 'none';
    chatElements.pill.style.transform = isChatOpen ? 'scale(0.9)' : 'scale(1)';
    chatElements.pill.innerHTML = isChatOpen ? 'Close Chat' : 'Chat with Kip';

    if (isChatOpen) {
      chatElements.input.focus();
      chatElements.messages.scrollTop = chatElements.messages.scrollHeight;
    }
  });

  // Add hover effect to pill
  chatElements.pill.addEventListener('mouseover', () => {
    chatElements.pill.style.transform = 'scale(1.05)';
  });

  chatElements.pill.addEventListener('mouseout', () => {
    chatElements.pill.style.transform = isChatOpen ? 'scale(0.9)' : 'scale(1)';
  });

  return chatElements;
};

// Store messages array
let messages = [];

// Update message rendering function
function renderMessages() {
  if (!chatElements?.messages) return;

  chatElements.messages.innerHTML = messages
    .map(
      msg => `
    <div style="${chatStyles.message} ${msg.isUser ? chatStyles.userMessage : chatStyles.botMessage}">
      <div style="font-size: 0.8em; margin-bottom: 5px">
        ${msg.isUser ? 'You' : 'Kip'} - ${msg.timestamp}
      </div>
      <div>${msg.content}</div>
    </div>
  `
    )
    .join('');

  chatElements.messages.scrollTop = chatElements.messages.scrollHeight;
}

function addMessage(message, isUser) {
  if (!chatElements?.messages) return;

  messages.push({
    content: message,
    isUser,
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  });

  renderMessages();
}

// Update handleSendMessage function
async function handleSendMessage() {
  if (!chatElements?.input) return;

  const message = chatElements.input.value.trim();
  if (!message) return;

  // Add user message to UI and chat history
  addMessage(message, true);
  chatHistory.push({ role: 'user', parts: [{ text: message }] });
  chatElements.input.value = '';

  try {
    const fullContext = await createFullMessageWithContext(`User Message: ${message}`);
    const result = await chat.sendMessage([fullContext.text, fullContext.image]);

    // Process the response
    const response = await handleAIResponse(result.response);

    // Add assistant's response to chat history (without the context)
    if (response) {
      chatHistory.push({ role: 'assistant', parts: [{ text: response }] });
    }
  } catch (error) {
    console.error('Error:', error);
    addMessage('Sorry, I encountered an error processing your request.', false);
  }
}

// Initialize chat when the page loads
let chatHistory = [];

async function initChat() {
  try {
    chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [
            {
              text: `
                You are an AI assistant helping users navigate a web application.

                GOAL:
                - Help users achieve their requests by utilizing all available information:
                  * Screenshots of the current page state
                  * HTML structure and content
                  * User interaction history
                  * Knowledge sources and documentation
                - Guide users step by step through their tasks using visual aids and clear instructions
                - Use highlighting tools when needed to point users to specific elements
                - Ensure users successfully complete their intended actions
                - Adapt guidance based on user interactions and feedback

                TOOLS:
                ${functionDefinitions
                  .map(
                    fn => `
                ${fn.name}:
                - Description: ${fn.description}
                - Required parameters: ${fn.parameters.required.join(', ')}
                `
                  )
                  .join('\n')}
                
                RULES:
                - Always be concise and direct in your responses.
                - Break the problem into smaller steps and explain to the user what steps need to follow
                - Always highlight to the user where to press/navigate by using highlightPageElement
                - Monitor user interactions after highlighting:
                  * When user clicks the correct element, remove current highlight and highlight the next element in sequence
                  * If the user clicks elsewhere, guide them back to the highlighted element
                - Each step should follow this pattern:
                  1. Highlight the target element
                  2. Wait for correct interaction
                  3. Remove current highlight and immediately highlight next element
                  4. Repeat until task is complete
                - Keep track of the current highlighted element and user's progress

                EXAMPLE RESPONSE PATTERN:
                When user clicks the correct element, respond like this:
                "Great! You've clicked the correct button. Now let's move to the next step."
                [Call removeActiveHighlight]
                [Call highlightPageElement for the next element]
                "Now click here to continue..."

                Or when moving between sections:
                "Perfect! Now let's go to the form section."
                [Call removeActiveHighlight]
                [Call highlightPageElement for the 'Buy now' link]
                "Click 'Buy Now' to see the application form."

                Remember to chain the remove and highlight commands together when transitioning between steps or remove the highlight step if it's not needed anymore.
                `,
            },
          ],
        },
      ],
      tools: [{ functionDeclarations: functionDefinitions }],
    });
    console.log('Chat initialized successfully');
  } catch (error) {
    console.error('Error initializing chat:', error);
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  createChatContainer();
  initChat();
  setupEventTracking();
});

// Helper function to create full message with context
async function createFullMessageWithContext(message) {
  const base64Image = await captureViewport();
  if (!base64Image) {
    throw new Error('Failed to capture viewport');
  }

  const htmlContent = document.documentElement.outerHTML;

  return {
    text: `${message}

Current Page URL: ${window.location.href}
Viewport Size: ${window.innerWidth}x${window.innerHeight}

Page HTML:
${htmlContent}`,
    image: {
      inlineData: {
        data: base64Image,
        mimeType: 'image/png',
      },
    },
  };
}

async function captureViewport() {
  try {
    // Create a temporary canvas for the screenshot
    const tempCanvas = document.createElement('canvas');
    tempCanvas.style.position = 'absolute';
    tempCanvas.style.top = '-9999px';
    tempCanvas.style.left = '-9999px';
    document.body.appendChild(tempCanvas);

    // Capture the screenshot
    const screenshot = await html2canvas(document.documentElement, {
      canvas: tempCanvas,
      logging: false,
      useCORS: true,
      allowTaint: true,
    });

    // Convert to base64
    const result = await new Promise(resolve => {
      screenshot.toBlob(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result.split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(blob);
      }, 'image/png');
    });

    // Clean up - remove the temporary canvas
    document.body.removeChild(tempCanvas);
    return result;
  } catch (error) {
    console.error('Error capturing viewport:', error);
    return null;
  }
}

async function handleFunctionCall(functionCall) {
  const { name, args } = functionCall;

  if (name === 'highlightPageElement') {
    return highlightPageElement(args.selector);
  } else if (name === 'removeActiveHighlight') {
    return removeActiveHighlight();
  }
  return `Function ${name} not implemented`;
}

// Update handleAIResponse to return the response text
async function handleAIResponse(response) {
  try {
    // Get the response parts
    const parts = response.candidates[0].content.parts;
    let responseText = '';

    // First, collect all text parts
    for (const part of parts) {
      if (part.text) {
        responseText += part.text + '\n';
      }
    }

    // Add the initial response text if any
    if (responseText) {
      addMessage(responseText.trim(), false);
    }

    // Then execute all function calls in sequence
    const functionCalls = parts.filter(part => part.functionCall);
    if (functionCalls.length > 0) {
      for (const part of functionCalls) {
        await handleFunctionCall(part.functionCall);
      }
    }

    return responseText.trim();
  } catch (error) {
    console.error('Error handling AI response:', error);
    addMessage('Sorry, I encountered an error processing the response.', false);
    return null;
  }
}

// Setup event tracking
function setupEventTracking() {
  // Track all clicks
  window.addEventListener('click', e => {
    trackInteraction('click', {
      target: {
        tagName: e.target.tagName,
        id: e.target.id,
        className: e.target.className,
        text: e.target.textContent?.slice(0, 100),
        href: e.target.href,
      },
      position: {
        x: e.clientX,
        y: e.clientY,
      },
    });
  });

  // Add other event tracking setup here...
}

// Update trackInteraction function
function trackInteraction(type, details) {
  userInteractions.push({
    type,
    details,
    timestamp: new Date().toISOString(),
  });

  // Notify AI if shouldKipObserveInteractions is true
  if (shouldKipObserveInteractions && chat && type === 'click') {
    const latestInteraction = {
      type,
      details,
      timestamp: new Date().toISOString(),
    };

    const interactionMessage = `User performed click action: ${JSON.stringify(
      latestInteraction,
      null,
      2
    )}`;

    // Add clean interaction message to chat history
    chatHistory.push({ role: 'user', parts: [{ text: interactionMessage }] });

    // Create and send the full message with context
    (async () => {
      try {
        const fullContext = await createFullMessageWithContext(interactionMessage);
        const result = await chat.sendMessage([fullContext.text, fullContext.image]);
        await handleAIResponse(result.response);
      } catch (error) {
        console.error('Error notifying AI of interaction:', error);
      }
    })();
  }
}

// Export any necessary functions or variables
export { userInteractions };
