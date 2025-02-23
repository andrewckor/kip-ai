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
function moveFloatingCursor(x, y) {
  // Get or create the floating cursor
  let cursor = document.querySelector('#cursor');
  if (!cursor) {
    // Create new cursor only if it doesn't exist
    cursor = document.createElement('div');
    cursor.id = 'cursor';
    cursor.innerHTML = CURSOR_IMAGE;
    cursor.style.position = 'fixed';
    document.body.appendChild(cursor);
  }

  // Update cursor position with transition for smooth movement
  cursor.style.transition = 'all 0.3s ease-in-out';
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;

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
    moveFloatingCursor(cursorX, cursorY);

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
  pillButton.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="min-width: 20px;">
        <path d="M12 3C7.02944 3 3 7.02944 3 12C3 13.8194 3.53987 15.5127 4.46815 16.9285L3.18198 20.8178L7.07127 19.5317C8.48713 20.4601 10.1806 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3Z" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
        <path d="M8 12H16M12 8V16" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
      </svg>
      <span>Kip</span>
    </div>
  `;
  pillButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #007bff;
    color: white;
    padding: 8px 16px;
    border-radius: 25px;
    cursor: pointer;
    font-weight: bold;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.5px;
    transition: all 0.3s ease;
  `;

  // Add floating animation keyframes
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes floatingButton {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
      100% { transform: translateY(0px); }
    }
    #chat-pill:not(.chat-open) {
      animation: floatingButton 3s ease-in-out infinite;
    }
    #chat-pill.chat-open {
      transform: scale(0.9);
    }
    #chat-pill.chat-open:hover {
      transform: scale(0.95);
    }
    #chat-pill:not(.chat-open):hover {
      animation-play-state: paused;
      transform: scale(1.05);
    }
  `;
  document.head.appendChild(styleSheet);

  // Create the chat container
  const chatContainer = document.createElement('div');
  chatContainer.innerHTML = `
    <div id="chat-container" style="${chatStyles.chatContainer} display: none; position: fixed; bottom: 80px; right: 20px; width: 350px; height: 500px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); border-radius: 10px; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #f8f9fa; border-bottom: 1px solid #dee2e6;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3C7.02944 3 3 7.02944 3 12C3 13.8194 3.53987 15.5127 4.46815 16.9285L3.18198 20.8178L7.07127 19.5317C8.48713 20.4601 10.1806 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3Z" 
              stroke="#007bff" 
              stroke-width="2" 
              stroke-linecap="round" 
              stroke-linejoin="round"
            />
            <path d="M8 12H16M12 8V16" 
              stroke="#007bff" 
              stroke-width="2" 
              stroke-linecap="round" 
              stroke-linejoin="round"
            />
          </svg>
          <span style="font-weight: bold; color: #2c3e50; font-size: 16px;">Kip AI</span>
        </div>
        <button 
          id="clear-history" 
          style="
            padding: 6px 12px;
            border: none;
            background: #f8f9fa;
            color: #6c757d;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 4px;
          "
          onmouseover="this.style.background='#e9ecef'; this.style.color='#495057';" 
          onmouseout="this.style.background='#f8f9fa'; this.style.color='#6c757d';"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6H21M19 6V20C19 21.1046 18.1046 22 17 22H7C5.89543 22 5 21.1046 5 20V6M8 6V4C8 2.89543 8.89543 2 10 2H14C15.1046 2 16 2.89543 16 4V6" 
              stroke="currentColor" 
              stroke-width="2" 
              stroke-linecap="round" 
              stroke-linejoin="round"
            />
          </svg>
          Clear
        </button>
      </div>
      <div id="chat-messages" style="${chatStyles.chatMessages}"></div>
      <div id="chat-input-container" style="${chatStyles.chatInputContainer}">
        <input 
          type="text"
          id="chat-input"
          placeholder="Type your message..."          
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
    clearButton: document.getElementById('clear-history'),
    pill: pillButton,
  };

  // Set up event listeners
  chatElements.sendButton.addEventListener('click', handleSendMessage);
  chatElements.input.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });

  // Add clear history functionality
  chatElements.clearButton.addEventListener('click', () => {
    clearDomainMessages();
  });

  // Add toggle functionality
  let isChatOpen = false;
  chatElements.pill.addEventListener('click', () => {
    isChatOpen = !isChatOpen;
    chatElements.container.style.display = isChatOpen ? 'flex' : 'none';

    // Update button content with logo for both states
    chatElements.pill.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="min-width: 20px;">
          <path d="M12 3C7.02944 3 3 7.02944 3 12C3 13.8194 3.53987 15.5127 4.46815 16.9285L3.18198 20.8178L7.07127 19.5317C8.48713 20.4601 10.1806 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3Z" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          />
          ${
            isChatOpen
              ? `
            <path d="M8 12L16 12" 
              stroke="currentColor" 
              stroke-width="2" 
              stroke-linecap="round" 
              stroke-linejoin="round"
            />
          `
              : `
            <path d="M8 12H16M12 8V16" 
              stroke="currentColor" 
              stroke-width="2" 
              stroke-linecap="round" 
              stroke-linejoin="round"
            />
          `
          }
        </svg>
        <span>${isChatOpen ? 'Close' : 'Kip'}</span>
      </div>
    `;

    // Toggle the chat-open class to control animation
    chatElements.pill.classList.toggle('chat-open', isChatOpen);

    if (isChatOpen) {
      chatElements.input.focus();
      chatElements.messages.scrollTop = chatElements.messages.scrollHeight;
    }
  });

  // Remove the hover event listeners since we're handling it with CSS now
  chatElements.pill.removeEventListener('mouseover', () => {});
  chatElements.pill.removeEventListener('mouseout', () => {});

  return chatElements;
};

// Store messages array and chat history
let messages = [];
let chatHistory = [];
const MESSAGE_LIMIT = 50;

// Helper function to trim messages and history to limit
function trimToLimit() {
  if (messages.length > MESSAGE_LIMIT) {
    messages = messages.slice(-MESSAGE_LIMIT);
  }
  if (chatHistory.length > MESSAGE_LIMIT) {
    chatHistory = chatHistory.slice(-MESSAGE_LIMIT);
  }
}

// Helper function to get current domain
function getCurrentDomain() {
  return window.location.hostname || 'default';
}

// Helper function to get storage keys for current domain
function getStorageKeys() {
  const domain = getCurrentDomain();
  return {
    messages: `kipMessages_${domain}`,
    history: `kipChatHistory_${domain}`,
  };
}

// Add localStorage functions for messages and history
function saveMessages() {
  if (typeof localStorage !== 'undefined') {
    try {
      trimToLimit(); // Trim before saving
      const keys = getStorageKeys();
      localStorage.setItem(keys.messages, JSON.stringify(messages));
      localStorage.setItem(keys.history, JSON.stringify(chatHistory));
    } catch (error) {
      console.error('Error saving messages to localStorage:', error);
    }
  }
}

function loadMessages() {
  if (typeof localStorage !== 'undefined') {
    try {
      const keys = getStorageKeys();
      const savedMessages = localStorage.getItem(keys.messages);
      const savedHistory = localStorage.getItem(keys.history);

      if (savedMessages) {
        messages = JSON.parse(savedMessages);
      }

      if (savedHistory) {
        chatHistory = JSON.parse(savedHistory);
      }

      trimToLimit(); // Ensure loaded messages are within limit

      if (chatElements?.messages) {
        renderMessages();
      }
    } catch (error) {
      console.error('Error loading messages from localStorage:', error);
      messages = [];
      chatHistory = [];
    }
  }
}

// Helper function to clear messages for current domain
function clearDomainMessages() {
  if (typeof localStorage !== 'undefined') {
    try {
      const keys = getStorageKeys();
      localStorage.removeItem(keys.messages);
      localStorage.removeItem(keys.history);
      messages = [];
      chatHistory = [];
      renderMessages();
    } catch (error) {
      console.error('Error clearing messages from localStorage:', error);
    }
  }
}

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
  saveMessages(); // Save messages after rendering
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

  trimToLimit(); // Ensure we stay within limit after adding
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

  trimToLimit(); // Ensure we stay within limit after adding
  saveMessages(); // Save after updating both messages and history

  try {
    const fullContext = await createFullMessageWithContext(`User Message: ${message}`);
    const result = await chat.sendMessage([fullContext.text, fullContext.image]);

    // Process the response
    const response = await handleAIResponse(result.response);

    // Add assistant's response to chat history
    if (response) {
      chatHistory.push({ role: 'assistant', parts: [{ text: response }] });
      trimToLimit(); // Ensure we stay within limit after AI response
      saveMessages(); // Save after AI response
    }
  } catch (error) {
    console.error('Error:', error);
    addMessage('Sorry, I encountered an error processing your request.', false);
  }
}

function formatFunctionDefinitions(definitions) {
  return definitions
    .map(
      fn =>
        ` ${fn.name}: - Description: ${fn.description} - Required parameters: ${fn.parameters.required.join(', ')}`
    )
    .join('\n');
}

// Update initChat to use saved history
async function initChat() {
  try {
    // Load saved messages first
    loadMessages();

    // Initialize chat with saved history
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
                ${formatFunctionDefinitions(functionDefinitions)}
                
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
        // Add saved chat history
        ...chatHistory,
      ],
      tools: [{ functionDeclarations: functionDefinitions }],
    });
    console.log('Chat initialized successfully with previous history');
  } catch (error) {
    console.error('Error initializing chat:', error);
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  createChatContainer();
  loadMessages(); // Load saved messages
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

// Update trackInteraction function to include limit
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
    trimToLimit(); // Ensure we stay within limit
    saveMessages(); // Save after updating history

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
