import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize canvas
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Define available functions for Gemini
const functionDefinitions = [
  {
    name: "highlightPageElement",
    description:
      "Highlight an element on the page to guide the user where to click or interact",
    parameters: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description:
            "The CSS selector or ID of the element to highlight (e.g., '#email' or '.submit-button')",
        },
      },
      required: ["selector"],
    },
  },
];

// Function implementation
function createFloatingCursor(x, y) {
  // Remove any existing floating cursor
  const existingCursor = document.querySelector(".floating-hand");
  if (existingCursor) {
    existingCursor.remove();
  }

  // Create the floating cursor element
  const cursor = document.createElement("div");
  cursor.className = "floating-hand";
  cursor.innerHTML = CURSOR_IMAGE;

  // Position the cursor
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;

  // Add to document
  document.body.appendChild(cursor);

  return cursor;
}

function highlightPageElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
    const rect = element.getBoundingClientRect();
    const coordinates = {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      element: selector,
    };

    // Highlight the element
    element.style.backgroundColor = "rgba(255, 0, 0, 0.2)";
    element.style.outline = "2px solid red";
    element.style.transition = "all 0.3s ease-in-out";

    // Create floating cursor below the element
    const cursorX = rect.left + window.scrollX + rect.width / 2 - 16; // Center horizontally
    const cursorY = rect.bottom + window.scrollY + 10; // 10px below the element
    createFloatingCursor(cursorX, cursorY);

    shouldKipObserveInteractions = true;
    return JSON.stringify(coordinates, null, 2);
  }
  return `Element with selector "${selector}" not found`;
}

// Set canvas size
function resizeCanvas() {
  const container = document.getElementById("canvas-container");
  canvas.width = container.clientWidth - 40; // Adjust for padding
  canvas.height = container.clientHeight - 40;
}

// Initial resize
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Drawing event listeners
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);

function startDrawing(e) {
  isDrawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function draw(e) {
  if (!isDrawing) return;

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.stroke();

  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function stopDrawing() {
  isDrawing = false;
}

// Chat functionality
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const sendButton = document.getElementById("send-button");

// Initialize Gemini with function calling
const genAI = new GoogleGenerativeAI(window.config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
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

// Function to add interaction to the array
function trackInteraction(type, details) {
  console.log({
    type,
    details,
    timestamp: new Date().toISOString(),
  });
  userInteractions.push({
    type,
    details,
    timestamp: new Date().toISOString(),
  });

  // Notify AI if shouldKipObserveInteractions is true
  if (shouldKipObserveInteractions && chat && type === "click") {
    const latestInteraction = {
      type,
      details,
      timestamp: new Date().toISOString(),
    };

    chat
      .sendMessage(
        `
        User performed click action: ${JSON.stringify(
          latestInteraction,
          null,
          2
        )}
        If this isn't what user supposed to do, advise them through the chat.
        `
      )
      .then((result) => {
        const response = result.response.text();
        addMessage(response, false);
      })
      .catch((error) =>
        console.error("Error notifying AI of interaction:", error)
      );
  }
}

// Generic event tracking setup
document.addEventListener("DOMContentLoaded", () => {
  // Track all clicks
  window.addEventListener("click", (e) => {
    trackInteraction("click", {
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
  window.addEventListener("input", (e) => {
    if (e.target.type !== "password") {
      trackInteraction("input", {
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
  window.addEventListener("submit", (e) => {
    const formData = new FormData(e.target);
    const safeFormData = {};

    for (let [key, value] of formData.entries()) {
      safeFormData[key] = key.includes("password") ? "[REDACTED]" : value;
    }

    trackInteraction("form_submission", {
      formId: e.target.id,
      data: safeFormData,
    });
  });

  // Track scroll with debouncing
  let scrollTimeout;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      trackInteraction("scroll", {
        position: {
          x: window.scrollX,
          y: window.scrollY,
        },
        percentage: {
          vertical:
            (window.scrollY /
              (document.documentElement.scrollHeight - window.innerHeight)) *
            100,
          horizontal:
            (window.scrollX /
              (document.documentElement.scrollWidth - window.innerWidth)) *
            100,
        },
      });
    }, 150);
  });

  // Track window resize with debouncing
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      trackInteraction("resize", {
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
  document.addEventListener("visibilitychange", () => {
    trackInteraction("visibility_change", {
      state: document.visibilityState,
    });
  });

  // Track user focus/blur on window
  window.addEventListener("focus", () => {
    trackInteraction("window_focus", {
      state: "focused",
    });
  });

  window.addEventListener("blur", () => {
    trackInteraction("window_focus", {
      state: "blurred",
    });
  });

  // Track page load timing
  window.addEventListener("load", () => {
    const timing = window.performance.timing;
    const navigationStart = timing.navigationStart;

    trackInteraction("page_load_metrics", {
      loadTime: timing.loadEventEnd - navigationStart,
      domReady: timing.domContentLoadedEventEnd - navigationStart,
      firstPaint: performance.getEntriesByType("paint")[0]?.startTime,
      firstContentfulPaint: performance.getEntriesByType("paint")[1]?.startTime,
    });
  });

  // Track when user leaves the page
  window.addEventListener("beforeunload", () => {
    trackInteraction("page_exit", {
      totalInteractions: userInteractions.length,
      timeOnPage: Date.now() - performance.timing.navigationStart,
    });
  });

  // Track network status changes
  window.addEventListener("online", () => {
    trackInteraction("network_status", { status: "online" });
  });

  window.addEventListener("offline", () => {
    trackInteraction("network_status", { status: "offline" });
  });
});

// Initialize chat when the page loads
async function initChat() {
  try {
    chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [
            {
              text: `
                You are an AI assistant helping users navigate a web application. 
                You can see the current state of the page through screenshots, and you have access to the following tools:

                TOOLS:
                ${functionDefinitions
                  .map(
                    (fn) => `
                ${fn.name}:
                - Description: ${fn.description}
                - Required parameters: ${fn.parameters.required.join(", ")}
                `
                  )
                  .join("\n")}
                
                RULES:
                - Always be concise and direct in your responses.
                - Break the problem into smaller steps and explain to the user what steps need to follow
                - Always hightlight to the user where to press/navigate by using highlightPageElement
                - In your evaluation of the next step consider the user interactions the user has already done
                `,
            },
          ],
        },
      ],
      tools: [{ functionDeclarations: functionDefinitions }],
    });
    console.log("Chat initialized successfully");
  } catch (error) {
    console.error("Error initializing chat:", error);
  }
}

// Initialize chat immediately
initChat();

async function captureViewport() {
  try {
    const canvas = await html2canvas(document.documentElement);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result.split(",")[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(blob);
      }, "image/png");
    });
  } catch (error) {
    console.error("Error capturing viewport:", error);
    return null;
  }
}

function addMessage(message, isUser) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message");
  messageDiv.classList.add(isUser ? "user-message" : "bot-message");

  // Add timestamp
  const timestamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const header = document.createElement("div");
  header.style.fontSize = "0.8em";
  header.style.marginBottom = "5px";
  header.textContent = `${isUser ? "You" : "Gemini"} - ${timestamp}`;
  messageDiv.appendChild(header);

  // Add message content
  const content = document.createElement("div");
  content.textContent = message;
  messageDiv.appendChild(content);

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function handleFunctionCall(functionCall) {
  const { name, args } = functionCall;

  if (name === "highlightPageElement") {
    return highlightPageElement(args.selector);
  }
  return `Function ${name} not implemented`;
}

async function handleSendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  // Add user message
  addMessage(message, true);
  chatInput.value = "";

  try {
    // Capture the viewport
    const base64Image = await captureViewport();

    if (!base64Image) {
      throw new Error("Failed to capture viewport");
    }

    // Get the HTML content of the page
    const htmlContent = document.documentElement.outerHTML;

    // Format user interactions for better readability
    const formattedInteractions = userInteractions.map((interaction) => ({
      ...interaction,
      timestamp: interaction.timestamp,
    }));

    // Create a context summary of recent interactions
    const recentInteractions = formattedInteractions.slice(-5); // Get last 5 interactions
    const interactionsSummary = JSON.stringify(recentInteractions, null, 2);
    console.log(recentInteractions, interactionsSummary);
    // Send message with context to Gemini
    const result = await chat.sendMessage([
      `User Message: ${message}

Recent User Interactions:
${interactionsSummary}

Total Interactions: ${userInteractions.length}
Current Page URL: ${window.location.href}
Viewport Size: ${window.innerWidth}x${window.innerHeight}

Page HTML:
${htmlContent}`,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/png",
        },
      },
    ]);

    const response = await result.response;

    // Check all parts for function calls
    const functionCalls = response.candidates[0].content.parts.filter(
      (part) => part.functionCall
    );

    if (functionCalls.length > 0) {
      // Handle all function calls sequentially
      for (const part of functionCalls) {
        const functionResponse = await handleFunctionCall(part.functionCall);

        // Send function response back to chat
        const followUpResult = await chat.sendMessage(
          `Function Response: ${functionResponse}`
        );
        const followUpText = followUpResult.response.text();
        addMessage(followUpText, false);
      }
    } else {
      // Regular text response
      const text = response.text();
      addMessage(text, false);
    }
  } catch (error) {
    console.error("Error:", error);
    addMessage("Sorry, I encountered an error processing your request.", false);
  }
}

sendButton.addEventListener("click", handleSendMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    handleSendMessage();
  }
});

// Export any necessary functions or variables
export { userInteractions };
