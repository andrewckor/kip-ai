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
    this.isSettingsOpen = false;
    this.settings = {
      enabledAudio: true,
    };

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
            id="settings-button" 
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
              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Settings
          </button>
          <div id="settings-menu" style="
            display: none;
            position: absolute;
            top: 50px;
            right: 10px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 12px;
            z-index: 1000;
          ">
            <div style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid #eee;
            ">
              <span style="font-size: 14px; color: #495057;">Enable Audio</span>
              <label class="toggle-switch" style="
                position: relative;
                display: inline-block;
                width: 40px;
                height: 20px;
              ">
                <input type="checkbox" id="audio-toggle" checked style="
                  opacity: 0;
                  width: 0;
                  height: 0;
                ">
                <span class="toggle-slider" style="
                  position: absolute;
                  cursor: pointer;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background-color: #ccc;
                  transition: .4s;
                  border-radius: 20px;
                "></span>
              </label>
            </div>
            <button 
              id="clear-history-btn"
              style="
                width: 100%;
                padding: 8px;
                border: none;
                background: #dc3545;
                color: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
              "
              onmouseover="this.style.background='#c82333'" 
              onmouseout="this.style.background='#dc3545'"
            >
              Clear History
            </button>
          </div>
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
      settingsButton: document.getElementById('settings-button'),
      settingsMenu: document.getElementById('settings-menu'),
      audioToggle: document.getElementById('audio-toggle'),
      clearHistoryBtn: document.getElementById('clear-history-btn'),
      pill: pillButton,
    };

    // Add styles for toggle switch
    const toggleStyles = document.createElement('style');
    toggleStyles.textContent = `
      .toggle-switch input:checked + .toggle-slider {
        background-color: #28a745;
      }
      .toggle-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
      }
      .toggle-switch input:checked + .toggle-slider:before {
        transform: translateX(20px);
      }
    `;
    document.head.appendChild(toggleStyles);

    // Set up event listeners
    this.chatElements.sendButton.addEventListener('click', () => this.handleSendMessage());
    this.chatElements.input.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.handleSendMessage();
      }
    });

    // Add settings functionality
    this.chatElements.settingsButton.addEventListener('click', () => this.toggleSettings());
    this.chatElements.audioToggle.addEventListener('change', e => {
      this.settings.enabledAudio = e.target.checked;
      this.saveSettings();
    });
    this.chatElements.clearHistoryBtn.addEventListener('click', () => {
      this.clearDomainMessages();
      this.toggleSettings();
    });

    // Load settings
    this.loadSettings();

    // Add toggle functionality
    this.chatElements.pill.addEventListener('click', () => this.toggleChat());

    // Close settings when clicking outside
    document.addEventListener('click', e => {
      if (
        this.isSettingsOpen &&
        !this.chatElements.settingsMenu.contains(e.target) &&
        !this.chatElements.settingsButton.contains(e.target)
      ) {
        this.toggleSettings();
      }
    });
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

  // Toggle settings menu
  toggleSettings() {
    this.isSettingsOpen = !this.isSettingsOpen;
    this.chatElements.settingsMenu.style.display = this.isSettingsOpen ? 'block' : 'none';
  }

  // Save settings to localStorage
  saveSettings() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('kipSettings', JSON.stringify(this.settings));
      } catch (error) {
        console.error('Error saving settings to localStorage:', error);
      }
    }
  }

  // Load settings from localStorage
  loadSettings() {
    if (typeof localStorage !== 'undefined') {
      try {
        const savedSettings = localStorage.getItem('kipSettings');
        if (savedSettings) {
          this.settings = JSON.parse(savedSettings);
          this.chatElements.audioToggle.checked = this.settings.enabledAudio;
        }
      } catch (error) {
        console.error('Error loading settings from localStorage:', error);
      }
    }
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const kip = new KipAI();
  await kip.init();
});
