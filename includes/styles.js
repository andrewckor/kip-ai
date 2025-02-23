// Chat styles object
export const chatStyles = {
  chatContainer: `
    display: flex;
    flex-direction: column;
    background: white;
    font-family: Arial, sans-serif;
    display: none;
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 350px;
    height: 500px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    border-radius: 10px;
    overflow: hidden;
    z-index: 99999;
  `,
  chatMessages: `
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  `,
  message: `
    margin-bottom: 15px;
    padding: 10px;
    border-radius: 12px;
    max-width: 80%;
    font-size: 14px;
    line-height: 1.2;
  `,
  userMessage: `
    background: #000000;
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
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
    resize: none;
    min-height: 40px;
    max-height: 120px;
    font-family: Arial, sans-serif;
    line-height: 1.4;
    overflow-y: auto;
  `,
  sendButton: `
    width: 100%;
    padding: 10px;
    background: #000000;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `,
  sendButtonHover: `
    background: #333333;
  `,
  pillInner: `
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: Arial, sans-serif;
  `,
};
