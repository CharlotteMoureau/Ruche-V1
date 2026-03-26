import domtoimage from "dom-to-image-more";

export function waitForCaptureFrame() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 300);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function mergeFrontAndBackCapture(
  frontDataUrl,
  backDataUrl,
  mergeErrorMessage,
) {
  const [frontImage, backImage] = await Promise.all([
    loadImage(frontDataUrl),
    loadImage(backDataUrl),
  ]);

  const spacing = 24;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(frontImage.width, backImage.width);
  canvas.height = frontImage.height + backImage.height + spacing;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(mergeErrorMessage);
  }

  context.drawImage(frontImage, 0, 0);
  context.drawImage(backImage, 0, frontImage.height + spacing);

  return canvas.toDataURL("image/png");
}

export async function captureBoardFrontAndBack(board, mergeErrorMessage) {
  if (!board) {
    throw new Error("Board not found");
  }

  document.body.classList.add("capture-mode");

  try {
    await waitForCaptureFrame();

    const frontDataUrl = await domtoimage.toPng(board, {
      cacheBust: true,
    });

    document.body.classList.add("capture-mode-back");
    await waitForCaptureFrame();

    const backDataUrl = await domtoimage.toPng(board, {
      cacheBust: true,
    });

    return mergeFrontAndBackCapture(
      frontDataUrl,
      backDataUrl,
      mergeErrorMessage,
    );
  } finally {
    document.body.classList.remove("capture-mode-back");
    document.body.classList.remove("capture-mode");
  }
}

export function sanitizeSnapshotFileName(title) {
  const safe = String(title || "ruche")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  return safe || "ruche";
}

export function triggerDownload(dataUrl, fileName) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}