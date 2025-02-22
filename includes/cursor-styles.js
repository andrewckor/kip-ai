export const cursorStyles = {
  floatingHand: `
    width: 32px;
    height: 32px;
    color: #000;
    position: fixed;
    animation: floatAnimation 3s ease-in-out infinite;
    pointer-events: none;
  `,
  floatingPoint: `
    transform-origin: center;
    animation: pulseAnimation 2s ease-in-out infinite;
  `,
};

// Add the keyframe animations to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes floatAnimation {
    0% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
    100% {
      transform: translateY(0px);
    }
  }

  @keyframes pulseAnimation {
    0% {
      transform: scale(1);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.2);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 0.8;
    }
  }
`;

document.head.appendChild(styleSheet);
