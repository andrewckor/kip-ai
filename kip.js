import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import { chatStyles } from './includes/styles.js';
import { CURSOR_IMAGE } from './includes/cursor-image.js';
import { captureViewport } from './includes/image-capture.js';

export class KipAI {
  static MESSAGE_LIMIT = 50;

  constructor(apiKey = config.GEMINI_API_KEY, genAiModel = 'gemini-2.0-flash-exp') {
    // Initialize state
    this.messages = [];
    this.chatHistory = [];
    this.userInteractions = [];
    this.shouldObserveInteractions = false;
    this.chatElements = null;
    this.currentlyHighlightedElement = null;
    this.isChatOpen = false;

    // Initialize Gemini
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: genAiModel });
    this.chat = null;

    // Function definitions for Gemini
    this.functionDefinitions = [
      {
        name: 'highlightPageElement',
        description:
          'Highlight an element on the page to guide the user where to click or interact',
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
              description:
                'The selector parameter is ignored but required by the API for consistency',
            },
          },
          required: ['selector'],
        },
      },
    ];
  }

  // Initialize the chat interface and functionality
  async init() {
    this.createChatContainer();
    await this.loadMessages();
    await this.initChat();
    this.setupEventTracking();
  }

  // Helper method to get current domain
  getCurrentDomain() {
    return window.location.hostname || 'default';
  }

  // Helper method to get storage keys for current domain
  getStorageKeys() {
    const domain = this.getCurrentDomain();
    return {
      messages: `kipMessages_${domain}`,
      history: `kipChatHistory_${domain}`,
    };
  }

  // Create and append chat container to the page
  createChatContainer() {
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
    this.chatElements = {
      container: document.getElementById('chat-container'),
      messages: document.getElementById('chat-messages'),
      input: document.getElementById('chat-input'),
      sendButton: document.getElementById('send-button'),
      clearButton: document.getElementById('clear-history'),
      pill: pillButton,
    };

    // Set up event listeners
    this.chatElements.sendButton.addEventListener('click', () => this.handleSendMessage());
    this.chatElements.input.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.handleSendMessage();
      }
    });

    // Add clear history functionality
    this.chatElements.clearButton.addEventListener('click', () => this.clearDomainMessages());

    // Add toggle functionality
    this.chatElements.pill.addEventListener('click', () => this.toggleChat());
  }

  // Toggle chat visibility
  toggleChat() {
    this.isChatOpen = !this.isChatOpen;
    this.chatElements.container.style.display = this.isChatOpen ? 'flex' : 'none';

    // Update button content with logo for both states
    this.chatElements.pill.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="min-width: 20px;">
          <path d="M12 3C7.02944 3 3 7.02944 3 12C3 13.8194 3.53987 15.5127 4.46815 16.9285L3.18198 20.8178L7.07127 19.5317C8.48713 20.4601 10.1806 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3Z" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          />
          ${
            this.isChatOpen
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
        <span>${this.isChatOpen ? 'Close' : 'Kip'}</span>
      </div>
    `;

    // Toggle the chat-open class to control animation
    this.chatElements.pill.classList.toggle('chat-open', this.isChatOpen);

    if (this.isChatOpen) {
      this.chatElements.input.focus();
      this.chatElements.messages.scrollTop = this.chatElements.messages.scrollHeight;
    }
  }

  // Move floating cursor
  moveFloatingCursor(x, y) {
    let cursor = document.querySelector('#cursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = 'cursor';
      cursor.innerHTML = CURSOR_IMAGE;
      cursor.style.position = 'fixed';
      document.body.appendChild(cursor);
    }

    cursor.style.transition = 'all 0.3s ease-in-out';
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;

    return cursor;
  }

  // Remove active highlight
  removeActiveHighlight() {
    const cursor = document.querySelector('.floating-hand');
    if (cursor) {
      cursor.remove();
    }

    if (this.currentlyHighlightedElement) {
      this.currentlyHighlightedElement.style.backgroundColor = '';
      this.currentlyHighlightedElement.style.outline = '';
      this.currentlyHighlightedElement.style.transition = '';
      this.currentlyHighlightedElement = null;
    }

    this.shouldObserveInteractions = false;
    return 'Highlight and cursor removed';
  }

  // Highlight page element
  highlightPageElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
      this.removeActiveHighlight();

      const rect = element.getBoundingClientRect();
      const coordinates = {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        element: selector,
      };

      element.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
      element.style.outline = '2px solid red';
      element.style.transition = 'all 0.3s ease-in-out';
      this.currentlyHighlightedElement = element;

      const elementRect = element.getBoundingClientRect();
      const isInViewport =
        elementRect.top >= 0 &&
        elementRect.left >= 0 &&
        elementRect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        elementRect.right <= (window.innerWidth || document.documentElement.clientWidth);

      if (!isInViewport) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const cursorX = rect.left + window.scrollX + rect.width / 2 - 16;
      const cursorY = rect.bottom + window.scrollY + 10;
      this.moveFloatingCursor(cursorX, cursorY);

      this.shouldObserveInteractions = true;
      return JSON.stringify(coordinates, null, 2);
    }
    return `Element with selector "${selector}" not found`;
  }

  // Helper method to trim messages to limit
  trimToLimit() {
    if (this.messages.length > KipAI.MESSAGE_LIMIT) {
      this.messages = this.messages.slice(-KipAI.MESSAGE_LIMIT);
    }
    if (this.chatHistory.length > KipAI.MESSAGE_LIMIT) {
      this.chatHistory = this.chatHistory.slice(-KipAI.MESSAGE_LIMIT);
    }
  }

  // Save messages to localStorage
  saveMessages() {
    if (typeof localStorage !== 'undefined') {
      try {
        this.trimToLimit();
        const keys = this.getStorageKeys();
        localStorage.setItem(keys.messages, JSON.stringify(this.messages));
        localStorage.setItem(keys.history, JSON.stringify(this.chatHistory));
      } catch (error) {
        console.error('Error saving messages to localStorage:', error);
      }
    }
  }

  // Helper method to migrate old chat history format
  migrateOldChatHistory(history) {
    return history.map(entry => {
      if (entry.role === 'assistant') {
        return { ...entry, role: 'model' };
      }
      return entry;
    });
  }

  // Load messages from localStorage
  async loadMessages() {
    if (typeof localStorage !== 'undefined') {
      try {
        const keys = this.getStorageKeys();
        const savedMessages = localStorage.getItem(keys.messages);
        const savedHistory = localStorage.getItem(keys.history);

        if (savedMessages) {
          this.messages = JSON.parse(savedMessages);
        }

        if (savedHistory) {
          this.chatHistory = this.migrateOldChatHistory(JSON.parse(savedHistory));
        }

        this.trimToLimit();

        if (this.chatElements?.messages) {
          this.renderMessages();
        }
      } catch (error) {
        console.error('Error loading messages from localStorage:', error);
        this.messages = [];
        this.chatHistory = [];
      }
    }
  }

  // Clear messages for current domain
  clearDomainMessages() {
    if (typeof localStorage !== 'undefined') {
      try {
        const keys = this.getStorageKeys();
        localStorage.removeItem(keys.messages);
        localStorage.removeItem(keys.history);
        this.messages = [];
        this.chatHistory = [];
        this.renderMessages();
      } catch (error) {
        console.error('Error clearing messages from localStorage:', error);
      }
    }
  }

  // Render messages in the chat container
  renderMessages() {
    if (!this.chatElements?.messages) return;

    this.chatElements.messages.innerHTML = this.messages
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

    this.chatElements.messages.scrollTop = this.chatElements.messages.scrollHeight;
    this.saveMessages();
  }

  // Add a message to the chat
  addMessage(message, isUser) {
    if (!this.chatElements?.messages) return;

    this.messages.push({
      content: message,
      isUser,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    });

    this.trimToLimit();
    this.renderMessages();
  }

  // Handle sending a message
  async handleSendMessage() {
    if (!this.chatElements?.input) return;

    const message = this.chatElements.input.value.trim();
    if (!message) return;

    this.addMessage(message, true);
    this.chatHistory.push({ role: 'user', parts: [{ text: message }] });
    this.chatElements.input.value = '';

    this.trimToLimit();
    this.saveMessages();

    try {
      const fullContext = await this.createFullMessageWithContext(`User Message: ${message}`);
      const result = await this.chat.sendMessage([fullContext.text, fullContext.image]);

      const response = await this.handleAIResponse(result.response);

      if (response) {
        this.chatHistory.push({ role: 'model', parts: [{ text: response }] });
        this.trimToLimit();
        this.saveMessages();
      }
    } catch (error) {
      console.error('Error:', error);
      this.addMessage('Sorry, I encountered an error processing your request.', false);
    }
  }

  // Format function definitions for Gemini
  formatFunctionDefinitions() {
    return this.functionDefinitions
      .map(
        fn =>
          ` ${fn.name}: - Description: ${fn.description} - Required parameters: ${fn.parameters.required.join(', ')}`
      )
      .join('\n');
  }

  // Initialize chat with Gemini
  async initChat() {
    try {
      this.chat = this.model.startChat({
        history: [
          {
            role: 'user',
            parts: [
              {
                text: `
                  You are an AI assistant helping users navigate ${window.document.title}.
                  Your name is "Kip".

                  Current url: ${window.location.origin}/${window.location.pathname}

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
                  ${this.formatFunctionDefinitions()}
                  
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
          ...this.chatHistory,
        ],
        tools: [{ functionDeclarations: this.functionDefinitions }],
      });
      console.log('Chat initialized successfully with previous history');
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  }

  // Create full message with context
  async createFullMessageWithContext(message) {
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

  // Handle function calls from Gemini
  async handleFunctionCall(functionCall) {
    const { name, args } = functionCall;

    if (name === 'highlightPageElement') {
      return this.highlightPageElement(args.selector);
    } else if (name === 'removeActiveHighlight') {
      return this.removeActiveHighlight();
    }
    return `Function ${name} not implemented`;
  }

  // Handle AI response
  async handleAIResponse(response) {
    try {
      const parts = response.candidates[0].content.parts;
      let responseText = '';

      for (const part of parts) {
        if (part.text) {
          responseText += part.text + '\n';
        }
      }

      if (responseText) {
        this.addMessage(responseText.trim(), false);
      }

      const functionCalls = parts.filter(part => part.functionCall);
      if (functionCalls.length > 0) {
        for (const part of functionCalls) {
          await this.handleFunctionCall(part.functionCall);
        }
      }

      return responseText.trim();
    } catch (error) {
      console.error('Error handling AI response:', error);
      this.addMessage('Sorry, I encountered an error processing the response.', false);
      return null;
    }
  }

  // Setup event tracking
  setupEventTracking() {
    window.addEventListener('click', e => {
      this.trackInteraction('click', {
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
  }

  // Track user interactions
  trackInteraction(type, details) {
    this.userInteractions.push({
      type,
      details,
      timestamp: new Date().toISOString(),
    });

    if (this.shouldObserveInteractions && this.chat && type === 'click') {
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

      this.chatHistory.push({ role: 'user', parts: [{ text: interactionMessage }] });
      this.trimToLimit();
      this.saveMessages();

      (async () => {
        try {
          const fullContext = await this.createFullMessageWithContext(interactionMessage);
          const result = await this.chat.sendMessage([fullContext.text, fullContext.image]);
          await this.handleAIResponse(result.response);
        } catch (error) {
          console.error('Error notifying AI of interaction:', error);
        }
      })();
    }
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const kip = new KipAI();
  await kip.init();
});
