import html2canvas from 'html2canvas';

export async function captureViewport() {
  try {
    const scale = 0.4;

    // Capture the screenshot - it returns a canvas
    const screenshot = await html2canvas(document.documentElement, {
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scale: 1,
      imageTimeout: 5000, // Increase timeout for image loading
      removeContainer: false,
      width: window.innerWidth,
      height: Math.max(
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight
      ),
    });

    // Create scaled canvas
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = screenshot.width * scale;
    scaledCanvas.height = screenshot.height * scale;
    const ctx = scaledCanvas.getContext('2d');

    // Use better image scaling algorithm
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    // Draw the screenshot onto the scaled canvas
    ctx.drawImage(screenshot, 0, 0, scaledCanvas.width, scaledCanvas.height);

    // Convert to base64
    const result = await new Promise(resolve => {
      scaledCanvas.toBlob(
        blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1];
            resolve(base64Data);
          };
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.7
      );
    });

    return result;
  } catch (error) {
    console.error('Error capturing viewport:', error);
    return null;
  }
}
