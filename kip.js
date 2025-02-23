import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import { chatStyles } from './includes/styles.js';
import { CURSOR_IMAGE } from './includes/cursor-image.js';
import { captureViewport } from './includes/image-capture.js';
import { ElevenLabsClient } from 'elevenlabs';

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
      isChatOpen: false,
    };
    this.currentAudio = null;
    this.currentlyPlayingMessageId = null; // Add tracking for currently playing message
    this.loadingAudioMessageId = null; // Add tracking for loading state

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
        description:
          'Remove any active highlight from the page when the user moved to next step or is not needed anymore',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description:
                "The CSS selector or ID of the element to remove the highlight from (e.g., '#email' or '.submit-button')",
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
    if (window.location.hostname.includes('http://localhost')) {
      return (window.location.hostname + window.location.pathname).replace(/[./]/g, '_');
    }
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

  // Add new helper method to get SVG eyes content
  getPillEyesSvg() {
    return `
      <svg width="26" height="20" viewBox="0 0 26 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="min-width: 26px; cursor: pointer;" class="pulse-ellipses">
        <ellipse cx="5" cy="12" rx="5" ry="5" fill="white" class="ellipse">
          <animate 
            attributeName="ry" 
            values="5;1;5" 
            dur="300ms"
            repeatCount="1"
            begin="0s; +5s"
            keyTimes="0;0.5;1"
          />
        </ellipse>
        <ellipse cx="21" cy="12" rx="5" ry="5" fill="white" class="ellipse">
          <animate 
            attributeName="ry" 
            values="5;1;5" 
            dur="300ms"
            repeatCount="1"
            begin="0.2s; +5.2s"
            keyTimes="0;0.5;1"
          />
        </ellipse>
      </svg>
    `;
  }

  // Create and append chat container to the page
  createChatContainer() {
    // Create the pill button
    const pillButton = document.createElement('div');
    pillButton.id = 'chat-pill';
    pillButton.innerHTML = this.getPillContent(false);
    pillButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 15px;
      background: #000000;
      color: white;
      padding: 15px 25px 15px 12px;
      border-radius: 14px;
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
        padding-top: 17px;
        padding-top: 17px;
        transition: all .2s;
      }
      #chat-pill.chat-open:hover {
        transform: scale(0.95);
      }
      #chat-pill:not(.chat-open):hover {
        animation-play-state: paused;
        transform: scale(1.05);
      }
      @keyframes pulseEllipses {
        0%, 100% { ry: 5px; }
        50% { ry: 1px; }
      }
      .pulse-ellipses .ellipse {
        animation: pulseEllipses 300ms ease-in-out infinite;
        animation-play-state: paused;
        animation-iteration-count: 1;
        animation-direction: alternate;
      }
      .pulse-ellipses .ellipse:first-child {
        animation-play-state: running;
        animation-delay: 0s, 5s;
      }
      .pulse-ellipses .ellipse:last-child {
        animation-play-state: running;
        animation-delay: 0.2s, 5.2s;
      }
      #chat-pill .pulse-ellipses {
        transition: transform .2s;
      }
      #chat-pill.chat-open .pulse-ellipses {
        transform: translateY(-12px) translateX(-4px);
      }
    `;
    document.head.appendChild(styleSheet);

    // Create the chat container
    const chatContainer = document.createElement('div');
    chatContainer.innerHTML = `
      <div id="chat-container" style="${chatStyles.chatContainer}">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #f8f9fa; border-bottom: 1px solid #dee2e6;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: bold; color: #2c3e50; font-size: 16px;">Kip AI</span>
          </div>
          <button 
            id="settings-button" 
            style="
              padding: 6px 12px;
              border: none;
              background: transparent;
              color: #9ca3af;
              border-radius: 6px;
              cursor: pointer;
              font-size: 13px;
              font-weight: 500;
              transition: all 0.2s ease;
              display: flex;
              align-items: center;
              gap: 4px;
            "
            onmouseover="this.style.background='#e5e7eb'; this.style.color='#4b5563';" 
            onmouseout="this.style.background='transparent'; this.style.color='#9ca3af';"
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
            top: -200px;
            right: 0;
            left: 0;
            background: #f8f9fa;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 16px;
            z-index: 1000;
            border: 1px solid #e5e7eb;
            opacity: 0;
            transition: all 0.3s ease;
            transform-origin: top;
          ">
            <div style="
              font-size: 16px;
              font-weight: 600;
              color: #111827;
              margin-bottom: 16px;
              padding-bottom: 16px;
              border-bottom: 1px solid #e5e7eb;
            ">
              Settings
            </div>
            <div style="
              display: flex;
              flex-direction: column;
              gap: 16px;
            ">
              <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-bottom: 16px;
                border-bottom: 1px solid #e5e7eb;
              ">
                <span style="font-size: 14px; color: #374151; font-weight: 500;">Enable Audio</span>
                <label class="toggle-switch" style="
                  position: relative;
                  display: inline-block;
                  width: 46px;
                  height: 24px;
                  flex-shrink: 0;
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
                    background-color: #d1d5db;
                    transition: .4s;
                    border-radius: 24px;
                  "></span>
                </label>
              </div>
              <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-bottom: 16px;
                border-bottom: 1px solid #e5e7eb;
              ">
                <span style="font-size: 14px; color: #374151; font-weight: 500;">Clear History</span>
                <button 
                  id="clear-history-btn"
                  style="
                    padding: 6px 12px;
                    border: none;
                    background: #dc3545;
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                  "
                  onmouseover="this.style.background='#c82333'" 
                  onmouseout="this.style.background='#dc3545'"
                >
                  Clear
                </button>
              </div>
              <button 
                id="close-settings-btn"
                style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid #e5e7eb;
                  background: #f3f4f6;
                  color: #374151;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 13px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                "
                onmouseover="this.style.background='#e5e7eb'" 
                onmouseout="this.style.background='#f3f4f6'"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        <div id="chat-messages" style="${chatStyles.chatMessages}"></div>
        <div id="chat-input-container" style="${chatStyles.chatInputContainer}">
          <textarea 
            id="chat-input"
            placeholder="Type your message..."          
            style="${chatStyles.chatInput}"
            rows="1"
          ></textarea>
          <button 
            id="send-button" 
            style="${chatStyles.sendButton}"
            onmouseover="this.style.background='#333333'" 
            onmouseout="this.style.background='#000000'"
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
        background-color: #10b981 !important;
      }
      .toggle-switch input:not(:checked) + .toggle-slider {
        background-color: #4b5563 !important;
      }
      .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        transition: all 0.3s ease !important;
        border-radius: 24px !important;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
      }
      .toggle-slider:before {
        position: absolute;
        content: "";
        height: 20px;
        width: 20px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        transition: all 0.3s ease;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }
      .toggle-switch input:checked + .toggle-slider:before {
        transform: translateX(22px);
      }
      .toggle-switch:hover .toggle-slider:before {
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }
    `;
    document.head.appendChild(toggleStyles);

    // Set up event listeners
    this.chatElements.sendButton.addEventListener('click', () => this.handleSendMessage());

    // Handle textarea auto-grow and key events
    this.chatElements.input.addEventListener('input', () => this.autoGrowTextarea());
    this.chatElements.input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          // Allow new line with Shift+Enter
          return;
        } else {
          // Prevent default to avoid new line and send message
          e.preventDefault();
          this.handleSendMessage();
        }
      }
    });

    // Add autoGrow method to the class
    this.autoGrowTextarea = () => {
      const textarea = this.chatElements.input;
      // Reset height to allow shrinking
      textarea.style.height = 'auto';
      // Set new height based on scrollHeight, but respect max-height from CSS
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = newHeight + 'px';
    };

    // Add settings functionality
    this.chatElements.settingsButton.addEventListener('click', () => this.toggleSettings());
    this.chatElements.audioToggle.addEventListener('change', e => {
      this.settings.enabledAudio = e.target.checked;
      this.saveSettings();
    });
    this.chatElements.clearHistoryBtn.addEventListener('click', () => {
      this.clearDomainMessages();
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
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

  // Update getPillContent to directly include the SVG
  getPillContent(isOpen) {
    return `
      <div style="${chatStyles.pillInner}">
        <div id="pill-eyes">
          ${this.getPillEyesSvg()}
        </div>
      </div>
    `;
  }

  // Update toggleChat to use the new helper
  toggleChat() {
    this.isChatOpen = !this.isChatOpen;
    this.settings.isChatOpen = this.isChatOpen;
    this.saveSettings();
    this.chatElements.container.style.display = this.isChatOpen ? 'flex' : 'none';
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

      return;
    }
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

        this.updateClearHistoryButton();
      } catch (error) {
        console.error('Error loading messages from localStorage:', error);
        this.messages = [];
        this.chatHistory = [];
        this.updateClearHistoryButton();
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
        this.updateClearHistoryButton();
      } catch (error) {
        console.error('Error clearing messages from localStorage:', error);
      }
    }
  }

  // Update the clear history button
  updateClearHistoryButton() {
    const clearButton = document.getElementById('clear-history-btn');
    if (clearButton) {
      const hasHistory = this.messages.length > 0 || this.chatHistory.length > 0;
      clearButton.disabled = !hasHistory;
      clearButton.style.opacity = hasHistory ? '1' : '0.5';
      clearButton.style.cursor = hasHistory ? 'pointer' : 'not-allowed';
      clearButton.style.background = hasHistory ? '#dc3545' : '#e9ecef';
    }
  }

  // Render messages in the chat container
  renderMessages() {
    if (!this.chatElements?.messages) return;

    this.chatElements.messages.innerHTML = this.messages
      .map(
        (msg, index) => `
      <div style="${chatStyles.message} ${msg.isUser ? chatStyles.userMessage : chatStyles.botMessage}; position: relative; ${
        !msg.isUser && this.currentlyPlayingMessageId === index
          ? 'background-color: rgba(0, 0, 0, 0.05); border-left: 3px solid #000000;'
          : ''
      } transition: all 0.3s ease;">
        ${
          !msg.isUser
            ? `
          <div style="
            position: absolute;
            top: 0;
            right: 0;
            padding: 8px;
            margin: 4px;
            border-radius: 4px;
            background: transparent;
            z-index: 2;
            transition: all 0.3s ease;
          ">
            <button 
              class="audio-control" 
              data-message-id="${index}"
              style="
                background: none;
                border: none;
                cursor: pointer;
                padding: 0;
                opacity: ${this.currentlyPlayingMessageId === index || this.loadingAudioMessageId === index ? '1' : '0.5'};
                transition: opacity 0.3s ease;
                display: ${this.settings.enabledAudio ? 'flex' : 'none'};
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
              "
            >
              ${
                this.loadingAudioMessageId === index
                  ? `
                <div class="simple-spinner" style="
                  width: 16px;
                  height: 16px;
                  border: 2px solid currentColor;
                  border-right-color: transparent;
                  border-radius: 50%;
                  animation: spin 0.75s linear infinite;
                  display: inline-block;
                ">
                </div>
                <style>
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                </style>
              `
                  : this.currentlyPlayingMessageId === index
                    ? `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6h12v12H6z" fill="currentColor"/>
                </svg>
              `
                    : `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" stroke-width="2"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" stroke-width="2"/>
                </svg>
              `
              }
            </button>
          </div>
        `
            : ''
        }
        <div style="white-space: pre-wrap; padding-right: ${!msg.isUser ? '32px' : '0'};">${msg.content}</div>
      </div>
    `
      )
      .join('');

    // Add click handlers for audio controls
    const audioControls = this.chatElements.messages.querySelectorAll('.audio-control');
    audioControls.forEach(control => {
      control.addEventListener('click', async () => {
        const messageId = parseInt(control.dataset.messageId);
        if (this.currentlyPlayingMessageId === messageId) {
          // Stop current audio
          if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
          }
          this.currentlyPlayingMessageId = null;
        } else {
          // Play this message's audio
          await this.speakText(this.messages[messageId].content, messageId);
        }
        this.renderMessages();
      });
    });

    this.chatElements.messages.scrollTop = this.chatElements.messages.scrollHeight;
    this.saveMessages();
    this.updateClearHistoryButton();
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

    // Speak bot messages if audio is enabled
    if (!isUser) {
      this.speakText(message, this.messages.length - 1);
    }
  }

  // Helper method to create chat with history
  createChatWithHistory() {
    return this.model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: this.getInitialPrompt() }],
        },
        ...this.chatHistory.slice(0, -1),
      ],
      tools: [{ functionDeclarations: this.functionDefinitions }],
    });
  }

  // Handle sending a message
  async handleSendMessage() {
    if (!this.chatElements?.input) return;

    const message = this.chatElements.input.value.trim();
    if (!message) return;

    // Add message to view and history immediately
    this.addMessage(message, true);
    this.chatHistory.push({ role: 'user', parts: [{ text: message }] });
    this.trimToLimit();
    this.saveMessages();

    this.chatElements.input.value = '';

    try {
      const fullContext = await this.createFullMessageWithContext(`User Message: ${message}`);
      const chat = this.createChatWithHistory();
      const result = await chat.sendMessage([fullContext.text, fullContext.image]);
      const response = await this.handleAIResponse(result.response);

      if (response) {
        // Add only the model response to history and save
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

  // Get initial prompt for chat initialization
  getInitialPrompt() {
    return `You are an AI assistant helping users navigate ${window.document.title}.
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

      Remember to: 
      - Chain the remove and highlight commands together when transitioning between steps
      - Remove the highlight step if it's not needed anymore.`.trim();
  }

  // Initialize chat with Gemini
  async initChat() {
    try {
      // Remove history from initial chat creation
      this.chat = this.model.startChat({
        tools: [{ functionDeclarations: this.functionDefinitions }],
      });
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
      User Viewport Size: ${window.innerWidth}x${window.innerHeight}
      Document Size: ${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}

      Page HTML:
      ${htmlContent}`,
      image: {
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg',
        },
      },
    };
  }

  // Handle function calls from Gemini
  handleFunctionCall(functionCall) {
    const { name, args } = functionCall;

    if (name === 'highlightPageElement') {
      this.highlightPageElement(args.selector);
    } else if (name === 'removeActiveHighlight') {
      this.removeActiveHighlight();
    }
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
          this.handleFunctionCall(part.functionCall);
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
      // Ignore clicks inside the chat container or pill button
      if (
        this.chatElements.container.contains(e.target) ||
        this.chatElements.pill.contains(e.target)
      ) {
        return;
      }

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

    if (this.shouldObserveInteractions && type === 'click') {
      const latestInteraction = {
        type,
        details,
        timestamp: new Date().toISOString(),
      };

      const interactionMessage = `User performed click action: 
      ${JSON.stringify(latestInteraction, null, 2)}
      
	    - If the user clicked the correct section/button/element then remove the active highlight using removeActiveHighlight.`.trim();

      this.chatHistory.push({ role: 'user', parts: [{ text: interactionMessage }] });
      this.trimToLimit();
      this.saveMessages();

      (async () => {
        try {
          const fullContext = await this.createFullMessageWithContext(interactionMessage);
          const chat = this.createChatWithHistory();
          const result = await chat.sendMessage([fullContext.text, fullContext.image]);
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
    const menu = this.chatElements.settingsMenu;

    if (this.isSettingsOpen) {
      menu.style.display = 'block';
      // Trigger reflow
      menu.offsetHeight;
      menu.style.opacity = '1';
      menu.style.top = '50px';
    } else {
      menu.style.opacity = '0';
      menu.style.top = '-200px';
      // Wait for animation to complete before hiding
      setTimeout(() => {
        menu.style.display = 'none';
      }, 300);
    }
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

          // If chat was open, toggle it
          if (this.settings.isChatOpen) {
            this.toggleChat();
          }
        }
      } catch (error) {
        console.error('Error loading settings from localStorage:', error);
      }
    }
  }

  // Speak text using ElevenLabs
  async speakText(text, messageId = null) {
    if (!this.settings.enabledAudio) return;

    try {
      // Stop any currently playing audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      // Set loading state
      this.loadingAudioMessageId = messageId;
      this.renderMessages();

      const elevenlabs = new ElevenLabsClient({
        apiKey: config.ELEVENLABS_API_KEY,
      });

      // Using a default voice ID for a female voice (Rachel)
      const VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

      // Make the API request
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
        method: 'POST',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': config.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);

      // Clear loading state
      this.loadingAudioMessageId = null;

      // Create and play audio
      this.currentAudio = new Audio(url);
      this.currentlyPlayingMessageId = messageId;
      this.renderMessages();

      await this.currentAudio.play();

      // Clean up when done
      this.currentAudio.onended = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.currentlyPlayingMessageId = null;
        this.renderMessages();
      };
    } catch (error) {
      console.error('Error speaking text:', error);
      this.loadingAudioMessageId = null;
      this.currentlyPlayingMessageId = null;
      this.renderMessages();
    }
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const kip = new KipAI();
  await kip.init();
});
