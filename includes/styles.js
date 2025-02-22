// Chat styles object
export const chatStyles = {
  chatContainer: `
    width: 300px;
    background: #f5f5f5;
    border-left: 1px solid #ddd;
    display: flex;
    flex-direction: column;
  `,
  chatMessages: `
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  `,
  message: `
    margin-bottom: 15px;
    padding: 10px;
    border-radius: 8px;
    max-width: 80%;
  `,
  userMessage: `
    background: #007bff;
    color: white;
    margin-left: auto;
  `,
  botMessage: `
    background: #e9ecef;
    color: black;
  `,
  chatInputContainer: `
    padding: 20px;
    border-top: 1px solid #ddd;
  `,
  chatInput: `
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 10px;
  `,
  sendButton: `
    width: 100%;
    padding: 10px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `,
  sendButtonHover: `
    background: #0056b3;
  `,
};
