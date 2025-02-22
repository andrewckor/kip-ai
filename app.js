// Initialize canvas
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
let isDrawing = false;
let lastX = 0;
let lastY = 0;

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

// Get API key from environment variable
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
let apiKey = null;

// Fetch API key from server
async function initializeAPI() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    apiKey = config.apiKey;
  } catch (error) {
    console.error("Error fetching API key:", error);
  }
}

// Initialize API key
initializeAPI();

async function sendMessageToGemini(message) {
  if (!apiKey) {
    return "Error: API key not initialized";
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: message,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error:", error);
    return "Sorry, I encountered an error processing your request.";
  }
}

function addMessage(message, isUser) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message");
  messageDiv.classList.add(isUser ? "user-message" : "bot-message");
  messageDiv.textContent = message;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function handleSendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  // Add user message
  addMessage(message, true);
  chatInput.value = "";

  // Get canvas data if needed
  const canvasData = canvas.toDataURL();

  // Send message to Gemini API
  const response = await sendMessageToGemini(message);
  addMessage(response, false);
}

sendButton.addEventListener("click", handleSendMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    handleSendMessage();
  }
});
