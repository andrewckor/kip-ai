# Gemini Canvas Chat

A simple web application that combines an HTML5 Canvas drawing board with a Gemini AI-powered chat interface. Users can draw on the canvas and chat with the Gemini AI model in an Intercom-style chat window.

## Features

- Interactive drawing canvas
- Real-time chat interface with Gemini AI
- Responsive design
- Canvas drawing tools
- Integration with Google's Gemini API

## Setup

1. Clone this repository to your local machine
2. Get a Gemini API key from the [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Replace `YOUR_API_KEY` in `app.js` with your actual Gemini API key
4. Serve the files using a local web server (e.g., using Python's `http.server` or VS Code's Live Server extension)

### Using Python's built-in server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Usage

- Left side: Draw freely on the canvas
- Right side: Chat with Gemini AI
- Type messages in the chat input and press Enter or click Send to interact with the AI

## Security Note

Make sure to keep your Gemini API key secure and never commit it to version control. In a production environment, you should handle the API key server-side.

## Dependencies

- html2canvas (included via CDN)
- Google Gemini API
