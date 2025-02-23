# Kip AI 🤖

Kip is an intelligent AI assistant that seamlessly integrates with your web browsing experience, providing contextual help and interaction through a powerful chat interface. Built with Google's Gemini AI, Kip understands your actions, the content you're viewing, and can assist you with various tasks while you browse.

## 🌟 Features

- **Contextual Understanding**: Kip observes and understands your web interactions in real-time
- **Smart Chat Interface**: Elegant floating chat window that can be toggled and positioned anywhere
- **Visual Context**: Captures and understands the visual context of your current webpage
- **Interactive Highlighting**: Can highlight and interact with specific elements on the page
- **Customizable Settings**: Configure Kip's behavior to suit your preferences
- **Message History**: Maintains chat history per domain with a 50-message limit
- **Privacy-Focused**: All data is stored locally in your browser

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- A Google Gemini API key

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/kip-ai.git
cd kip-ai
```

2. Install dependencies:

```bash
npm install
```

3. Configure your API key:
   Create or modify `config.js` in the root directory:

```javascript
export const config = {
  GEMINI_API_KEY: 'your-api-key-here',
};
```

4. Start the development server:

```bash
npm run dev
```

### Building for Production

```bash
npm run build:prod
```

5. Navigate to [http://localhost:5173/examples/](http://localhost:5173/examples/) to explore different integration examples and choose one that best fits your use case.

## 🛠️ Tech Stack

- Google Gemini AI API
- React
- Vite
- HTML2Canvas for viewport capture
- Modern JavaScript (ES Modules)

## 📝 License

Proprietary - Copyright © 2025 Andreas Kordampalos and Ioannis Kolovos

This software is part of the ElevenLabs x a16z Worldwide Hackathon. See [LICENSE](LICENSE) for details.

## 👥 Authors

- [Andreas Kordampalos](https://github.com/andrewckor)
- [Ioannis Kolovos](https://github.com/msroot)

## 📧 Contact

For usage inquiries, please contact: andrew@ckor.me
