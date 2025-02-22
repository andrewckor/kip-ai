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
    name: "getElementCoordinates",
    description: "Get the coordinates of an element on the page and log them",
    parameters: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description:
            "The CSS selector or ID of the element (e.g., '#email' or '.email-address-input')",
        },
      },
      required: ["selector"],
    },
  },
];

// Function implementation
function getElementCoordinates(selector) {
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
    const theElement = document.querySelector(selector);
    console.log("Element Coordinates:", theElement);
    theElement.style.backgroundColor = "red";
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
let chat;

// Initialize chat when the page loads
async function initChat() {
  try {
    chat = model.startChat({
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

  if (name === "getElementCoordinates") {
    return getElementCoordinates(args.selector);
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

    // Send message, image, and HTML to Gemini
    const result = await chat.sendMessage([
      `User Message: ${message}\n\nPage HTML:\n${htmlContent}`,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/png",
        },
      },
    ]);

    const response = await result.response;

    // Handle function calls if any
    if (response.candidates[0].content.parts[0].functionCall) {
      const functionCall = response.candidates[0].content.parts[0].functionCall;
      const functionResponse = await handleFunctionCall(functionCall);

      // Send function response back to chat
      const followUpResult = await chat.sendMessage(
        `Function Response: ${functionResponse}`
      );
      const followUpText = followUpResult.response.text();
      addMessage(followUpText, false);
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
export {};
