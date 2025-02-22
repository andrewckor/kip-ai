import { GoogleGenerativeAI } from '@google/generative-ai';
import html2canvas from 'html2canvas';
import { config } from './config.js';

// Define available functions for Gemini
const functionDefinitions = [{
        name: 'highlightPageElement',
        description: 'Highlight an element on the page to guide the user where to click or interact',
        parameters: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: "The CSS selector or ID of the element to highlight (e.g., '#email' or '.submit-button')",
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
    const existingCursor = document.querySelector('.floating-hand');
    if (existingCursor) {
        existingCursor.remove();
    }

    // Create the floating cursor element
    const cursor = document.createElement('div');
    cursor.className = 'floating-hand';
    cursor.innerHTML = CURSOR_IMAGE;

    // Position the cursor
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;

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

        // Create floating cursor below the element
        const cursorX = rect.left + window.scrollX + rect.width / 2 - 16; // Center horizontally
        const cursorY = rect.bottom + window.scrollY + 10; // 10px below the element
        createFloatingCursor(cursorX, cursorY);

        shouldKipObserveInteractions = true;
        return JSON.stringify(coordinates, null, 2);
    }
    return `Element with selector "${selector}" not found`;
}

// Chat functionality
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');

// Initialize Gemini with function calling
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
const userInteractions = [];
let shouldKipObserveInteractions = false;
let chat;

const CURSOR_IMAGE = `<svg
      id="cursor"
      class="floating-hand"
      width="394"
      height="420"
      viewBox="0 0 394 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="131.25" width="52.5" height="393.75" fill="white" />
      <rect x="78.75" y="183.75" width="26.25" height="131.25" fill="white" />
      <rect x="262.5" y="367.5" width="26.25" height="26.25" fill="white" />
      <rect x="105" y="236.25" width="236.25" height="105" fill="white" />
      <rect x="341.25" y="288.75" width="26.25" height="52.5" fill="white" />
      <rect x="367.5" y="157.5" width="26.25" height="131.25" fill="white" />
      <rect x="315" y="131.25" width="52.5" height="157.5" fill="white" />
      <rect x="315" y="157.5" width="26.25" height="26.25" fill="white" />
      <rect x="262.5" y="105" width="26.25" height="78.75" fill="white" />
      <rect x="236.25" y="236.25" width="26.25" height="105" fill="white" />
      <rect x="288.75" y="236.25" width="26.25" height="105" fill="white" />
      <rect x="315" y="341.25" width="26.25" height="78.75" fill="white" />
      <rect x="288.75" y="393.75" width="26.25" height="26.25" fill="white" />
      <rect
        x="131.25"
        y="393.75"
        width="131.25"
        height="26.25"
        fill="white"
        class="floating-point"
      />
      <rect x="131.25" y="367.5" width="26.25" height="26.25" fill="white" />
      <rect x="105" y="341.25" width="26.25" height="26.25" fill="white" />
      <rect x="78.75" y="315" width="26.25" height="26.25" fill="white" />
      <rect x="52.5" y="262.5" width="26.25" height="52.5" fill="white" />
      <rect x="26.25" y="236.25" width="26.25" height="26.25" fill="white" />
      <rect y="183.75" width="26.25" height="52.5" fill="white" />
      <rect x="26.25" y="157.5" width="52.5" height="105" fill="white" />
      <rect x="183.75" y="105" width="131.25" height="288.75" fill="white" />
      <rect x="183.75" y="26.25" width="26.25" height="157.5" fill="white" />
      <rect x="105" y="26.25" width="26.25" height="236.25" fill="white" />
      <rect x="131.25" width="52.5" height="26.25" fill="black" />
      <rect x="78.75" y="183.75" width="26.25" height="26.25" fill="black" />
      <rect x="262.5" y="367.5" width="26.25" height="26.25" fill="black" />
      <rect x="183.75" y="236.25" width="26.25" height="105" fill="black" />
      <rect x="341.25" y="288.75" width="26.25" height="52.5" fill="black" />
      <rect x="367.5" y="157.5" width="26.25" height="131.25" fill="black" />
      <rect x="315" y="131.25" width="52.5" height="26.25" fill="black" />
      <rect x="315" y="157.5" width="26.25" height="26.25" fill="black" />
      <rect x="262.5" y="105" width="26.25" height="78.75" fill="black" />
      <rect x="236.25" y="236.25" width="26.25" height="105" fill="black" />
      <rect x="288.75" y="236.25" width="26.25" height="105" fill="black" />
      <rect x="315" y="341.25" width="26.25" height="78.75" fill="black" />
      <rect x="288.75" y="393.75" width="26.25" height="26.25" fill="black" />
      <rect x="131.25" y="393.75" width="131.25" height="26.25" fill="black" />
      <rect x="131.25" y="367.5" width="26.25" height="26.25" fill="black" />
      <rect x="105" y="341.25" width="26.25" height="26.25" fill="black" />
      <rect x="78.75" y="315" width="26.25" height="26.25" fill="black" />
      <rect x="52.5" y="262.5" width="26.25" height="52.5" fill="black" />
      <rect x="26.25" y="236.25" width="26.25" height="26.25" fill="black" />
      <rect y="183.75" width="26.25" height="52.5" fill="black" />
      <rect x="26.25" y="157.5" width="52.5" height="26.25" fill="black" />
      <rect x="183.75" y="105" width="131.25" height="26.25" fill="black" />
      <rect x="183.75" y="26.25" width="26.25" height="157.5" fill="black" />
      <rect x="105" y="26.25" width="26.25" height="236.25" fill="black" />
    </svg>`;

// Initialize chat when the page loads
let chatHistory = [];

async function initChat() {
    try {
        chat = model.startChat({
                    history: [{
                                role: 'user',
                                parts: [{
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
                    (fn) => `
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

// Update handleSendMessage function
async function handleSendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  // Add user message to UI and chat history
  addMessage(message, true);
  chatHistory.push({ role: 'user', parts: [{ text: message }] });
  chatInput.value = '';

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
    const functionCalls = parts.filter((part) => part.functionCall);
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
    )}
	- If this isn't what user supposed to do, advise them through the chat. And do not remove the active highlight
	- If the user did the correct action then remove the active highlight.`;

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

// Initialize chat immediately
initChat();

// Generic event tracking setup
document.addEventListener('DOMContentLoaded', () => {
  // Track all clicks
  window.addEventListener('click', (e) => {
    trackInteraction('click', {
      target: {
        tagName: e.target.tagName,
        id: e.target.id,
        className: e.target.className,
        text: e.target.textContent?.slice(0, 100), // Limit text length
        href: e.target.href,
      },
      position: {
        x: e.clientX,
        y: e.clientY,
      },
    });
  });

  // Track all input interactions
  window.addEventListener('input', (e) => {
    if (e.target.type !== 'password') {
      trackInteraction('input', {
        element: {
          type: e.target.type,
          id: e.target.id,
          name: e.target.name,
        },
        value: e.target.value,
      });
    }
  });

  // Track form submissions
  window.addEventListener('submit', (e) => {
    const formData = new FormData(e.target);
    const safeFormData = {};

    for (let [key, value] of formData.entries()) {
      safeFormData[key] = key.includes('password') ? '[REDACTED]' : value;
    }

    trackInteraction('form_submission', {
      formId: e.target.id,
      data: safeFormData,
    });
  });

  // Track scroll with debouncing
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      trackInteraction('scroll', {
        position: {
          x: window.scrollX,
          y: window.scrollY,
        },
        percentage: {
          vertical:
            (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100,
          horizontal:
            (window.scrollX / (document.documentElement.scrollWidth - window.innerWidth)) * 100,
        },
      });
    }, 150);
  });

  // Track window resize with debouncing
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      trackInteraction('resize', {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        screen: {
          width: window.screen.width,
          height: window.screen.height,
        },
      });
    }, 150);
  });

  // Track page visibility changes
  document.addEventListener('visibilitychange', () => {
    trackInteraction('visibility_change', {
      state: document.visibilityState,
    });
  });

  // Track user focus/blur on window
  window.addEventListener('focus', () => {
    trackInteraction('window_focus', {
      state: 'focused',
    });
  });

  window.addEventListener('blur', () => {
    trackInteraction('window_focus', {
      state: 'blurred',
    });
  });

  // Track page load timing
  window.addEventListener('load', () => {
    const timing = window.performance.timing;
    const navigationStart = timing.navigationStart;

    trackInteraction('page_load_metrics', {
      loadTime: timing.loadEventEnd - navigationStart,
      domReady: timing.domContentLoadedEventEnd - navigationStart,
      firstPaint: performance.getEntriesByType('paint')[0]?.startTime,
      firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime,
    });
  });

  // Track when user leaves the page
  window.addEventListener('beforeunload', () => {
    trackInteraction('page_exit', {
      totalInteractions: userInteractions.length,
      timeOnPage: Date.now() - performance.timing.navigationStart,
    });
  });

  // Track network status changes
  window.addEventListener('online', () => {
    trackInteraction('network_status', { status: 'online' });
  });

  window.addEventListener('offline', () => {
    trackInteraction('network_status', { status: 'offline' });
  });
});

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
    const result = await new Promise((resolve) => {
      screenshot.toBlob((blob) => {
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

function addMessage(message, isUser) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  messageDiv.classList.add(isUser ? 'user-message' : 'bot-message');

  // Add timestamp
  const timestamp = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const header = document.createElement('div');
  header.style.fontSize = '0.8em';
  header.style.marginBottom = '5px';
  header.textContent = `${isUser ? 'You' : 'Kip'} - ${timestamp}`;
  messageDiv.appendChild(header);

  // Add message content
  const content = document.createElement('div');
  content.textContent = message;
  messageDiv.appendChild(content);

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
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

sendButton.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleSendMessage();
  }
});

// Export any necessary functions or variables
export { userInteractions };