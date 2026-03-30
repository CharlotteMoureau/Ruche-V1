import domtoimage from "dom-to-image-more";
import JSZip from "jszip";

const EXPORT_STAGE_STYLE = {
  position: "fixed",
  left: "-10000px",
  top: "0",
  pointerEvents: "none",
  zIndex: "-1",
};

const EXPORT_SURFACE_STYLE = {
  width: "1120px",
  boxSizing: "border-box",
  padding: "40px",
  background: "#f5efe2",
  color: "#2f2921",
  fontFamily:
    '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
};

const EXPORT_PANEL_STYLE = {
  background: "#fffaf2",
  border: "1px solid #e3d7c0",
  borderRadius: "20px",
  boxShadow: "0 14px 36px rgba(77, 52, 24, 0.12)",
  padding: "28px",
};

const EXPORT_COMMENT_STYLE = {
  background: "#f9f7f4",
  border: "1px solid #e0dcd5",
  borderRadius: "12px",
  padding: "16px 18px",
};

function applyStyles(element, styles) {
  Object.assign(element.style, styles);
  return element;
}

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text) {
    element.textContent = options.text;
  }

  if (options.styles) {
    applyStyles(element, options.styles);
  }

  return element;
}

function formatExportDateTime(value, formatter) {
  if (typeof formatter === "function") {
    return formatter(value);
  }

  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getActorLabel(actor, fallbackLabel) {
  return actor?.username || actor?.email || fallbackLabel || "-";
}

function hasMessage(value) {
  return Boolean(String(value || "").trim());
}

function sortCardsForExport(cards) {
  return [...cards].sort((left, right) => {
    const leftY = Number(left?.position?.y ?? 0);
    const rightY = Number(right?.position?.y ?? 0);
    if (leftY !== rightY) return leftY - rightY;

    const leftX = Number(left?.position?.x ?? 0);
    const rightX = Number(right?.position?.x ?? 0);
    if (leftX !== rightX) return leftX - rightX;

    return String(left?.title || "").localeCompare(String(right?.title || ""));
  });
}

function appendSectionHeader(root, title) {
  const heading = createElement("h1", {
    text: title,
    styles: {
      margin: "0 0 24px",
      fontSize: "32px",
      lineHeight: "1.2",
      color: "#3f2c18",
    },
  });

  root.appendChild(heading);
}

function createEmptyState(message) {
  return createElement("p", {
    text: message,
    styles: {
      margin: "0",
      color: "#7f7363",
      fontStyle: "italic",
      textAlign: "center",
      padding: "28px 0 12px",
      fontSize: "18px",
    },
  });
}

function createCommentItem({
  author,
  dateText,
  message,
  isReply = false,
}) {
  const item = createElement("div", {
    styles: {
      ...EXPORT_COMMENT_STYLE,
      marginTop: isReply ? "12px" : "0",
      marginLeft: isReply ? "32px" : "0",
      borderLeft: isReply ? "4px solid #f4c44e" : EXPORT_COMMENT_STYLE.border,
      background: isReply ? "#f3f0ea" : EXPORT_COMMENT_STYLE.background,
    },
  });

  const header = createElement("div", {
    styles: {
      display: "flex",
      alignItems: "baseline",
      gap: "10px",
      flexWrap: "wrap",
      marginBottom: "8px",
    },
  });

  header.appendChild(
    createElement("strong", {
      text: author,
      styles: {
        fontSize: "17px",
        color: "#2d241a",
      },
    }),
  );

  header.appendChild(
    createElement("span", {
      text: dateText,
      styles: {
        fontSize: "13px",
        color: "#8d8170",
      },
    }),
  );

  item.appendChild(header);
  item.appendChild(
    createElement("p", {
      text: message,
      styles: {
        margin: "0",
        fontSize: "16px",
        lineHeight: "1.55",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      },
    }),
  );

  return item;
}

function createChatExportNode({
  comments,
  chatTitle,
  noCommentsMessage,
  formatDateTime,
  unknownUserLabel,
}) {
  const surface = createElement("section", { styles: EXPORT_SURFACE_STYLE });
  appendSectionHeader(surface, chatTitle);

  const panel = createElement("div", { styles: EXPORT_PANEL_STYLE });
  surface.appendChild(panel);

  if (!comments.length) {
    panel.appendChild(createEmptyState(noCommentsMessage));
    return surface;
  }

  comments.forEach((comment, index) => {
    const thread = createElement("article", {
      styles: {
        marginTop: index ? "18px" : "0",
      },
    });

    thread.appendChild(
      createCommentItem({
        author: getActorLabel(comment.author, unknownUserLabel),
        dateText: formatExportDateTime(comment.createdAt, formatDateTime),
        message: comment.message,
      }),
    );

    (comment.replies || []).forEach((reply) => {
      thread.appendChild(
        createCommentItem({
          author: getActorLabel(reply.author, unknownUserLabel),
          dateText: formatExportDateTime(reply.createdAt, formatDateTime),
          message: reply.message,
          isReply: true,
        }),
      );
    });

    panel.appendChild(thread);
  });

  return surface;
}

function createCardNotesExportNode({
  boardCards,
  cardNotesTitle,
  noCardNotesMessage,
  cardLabel,
  unknownUserLabel,
  formatCreatedByText,
  formatUpdatedByText,
}) {
  const surface = createElement("section", { styles: EXPORT_SURFACE_STYLE });
  appendSectionHeader(surface, cardNotesTitle);

  const panel = createElement("div", { styles: EXPORT_PANEL_STYLE });
  surface.appendChild(panel);

  const cardsWithComments = sortCardsForExport(boardCards).filter((card) =>
    hasMessage(card?.comment?.message),
  );

  if (!cardsWithComments.length) {
    panel.appendChild(createEmptyState(noCardNotesMessage));
    return surface;
  }

  cardsWithComments.forEach((card, index) => {
    const wrapper = createElement("article", {
      styles: {
        ...EXPORT_COMMENT_STYLE,
        marginTop: index ? "18px" : "0",
        background: "#fffdf8",
      },
    });

    wrapper.appendChild(
      createElement("h2", {
        text: `${cardLabel}: ${card.title || "-"}`,
        styles: {
          margin: "0 0 10px",
          fontSize: "22px",
          lineHeight: "1.3",
          color: "#3b2c1d",
        },
      }),
    );

    wrapper.appendChild(
      createElement("p", {
        text: card.comment.message,
        styles: {
          margin: "0",
          fontSize: "16px",
          lineHeight: "1.6",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        },
      }),
    );

    const meta = createElement("div", {
      styles: {
        marginTop: "12px",
        display: "grid",
        gap: "4px",
      },
    });

    meta.appendChild(
      createElement("p", {
        text: formatCreatedByText({
          createdAt: card.comment.createdAt,
          createdBy: getActorLabel(card.comment.createdBy, unknownUserLabel),
        }),
        styles: {
          margin: "0",
          fontSize: "13px",
          color: "#7a6d5b",
        },
      }),
    );

    meta.appendChild(
      createElement("p", {
        text: formatUpdatedByText({
          updatedAt: card.comment.updatedAt,
          updatedBy: getActorLabel(card.comment.updatedBy, unknownUserLabel),
        }),
        styles: {
          margin: "0",
          fontSize: "13px",
          color: "#7a6d5b",
        },
      }),
    );

    wrapper.appendChild(meta);
    panel.appendChild(wrapper);
  });

  return surface;
}

async function captureDetachedNode(node) {
  const stage = createElement("div", { styles: EXPORT_STAGE_STYLE });
  stage.appendChild(node);
  document.body.appendChild(stage);

  try {
    await waitForCaptureFrame();
    return await domtoimage.toPng(node, {
      cacheBust: true,
      bgcolor: "#f5efe2",
    });
  } finally {
    stage.remove();
  }
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function createZipFromImages(files) {
  const zip = new JSZip();

  await Promise.all(
    files.map(async (file) => {
      zip.file(file.name, await dataUrlToBlob(file.dataUrl));
    }),
  );

  return zip.generateAsync({ type: "blob" });
}

async function captureBoardImages(board) {
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

    return {
      frontDataUrl,
      backDataUrl,
    };
  } finally {
    document.body.classList.remove("capture-mode-back");
    document.body.classList.remove("capture-mode");
  }
}

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
  const { frontDataUrl, backDataUrl } = await captureBoardImages(board);

  return mergeFrontAndBackCapture(frontDataUrl, backDataUrl, mergeErrorMessage);
}

export async function captureHiveExportBundle({
  board,
  title,
  comments = [],
  boardCards = [],
  chatTitle,
  noCommentsMessage,
  cardNotesTitle,
  noCardNotesMessage,
  cardLabel,
  unknownUserLabel,
  formatDateTime,
  formatCreatedByText,
  formatUpdatedByText,
}) {
  const { frontDataUrl, backDataUrl } = await captureBoardImages(board);
  const chatDataUrl = await captureDetachedNode(
    createChatExportNode({
      comments,
      chatTitle,
      noCommentsMessage,
      formatDateTime,
      unknownUserLabel,
    }),
  );
  const cardCommentsDataUrl = await captureDetachedNode(
    createCardNotesExportNode({
      boardCards,
      cardNotesTitle,
      noCardNotesMessage,
      cardLabel,
      unknownUserLabel,
      formatCreatedByText,
      formatUpdatedByText,
    }),
  );

  const zipBlob = await createZipFromImages([
    { name: "01-front-board.png", dataUrl: frontDataUrl },
    { name: "02-back-board.png", dataUrl: backDataUrl },
    { name: "03-hive-chat.png", dataUrl: chatDataUrl },
    { name: "04-card-notes.png", dataUrl: cardCommentsDataUrl },
  ]);

  return {
    blob: zipBlob,
    fileName: `${sanitizeSnapshotFileName(title)}-captures.zip`,
  };
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
  const objectUrl =
    typeof dataUrl === "string" ? dataUrl : URL.createObjectURL(dataUrl);
  link.href = objectUrl;
  link.click();

  if (typeof dataUrl !== "string") {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}