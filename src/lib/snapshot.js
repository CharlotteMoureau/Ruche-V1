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

const BOARD_CAPTURE_PADDING = 96;
const DEFAULT_EXPORT_SCALE = 3;
const MAX_EXPORT_CANVAS_DIMENSION = 12000;
const MAX_EXPORT_CANVAS_PIXELS = 60_000_000;
const CHAT_EXPORT_CHUNK_SIZE = 10;
const PREVIEW_CARD_SIZE = 200;
const PREVIEW_BOARD_WIDTH = 2200;
const PREVIEW_BOARD_HEIGHT = 1600;

const PREVIEW_FRONT_LAYOUT = {
  idFontSize: 0.085,
  idY: 0.22,
  titleFontSize: 0.063,
  titleStartY: 0.34,
  titleMaxWidth: 0.72,
  titleLineHeight: 0.08,
  titleMaxLines: 2,
  iconSize: 0.23,
  iconCenterY: 0.74,
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

function getBoundedExportScale(width, height, preferredScale = DEFAULT_EXPORT_SCALE) {
  if (width <= 0 || height <= 0) {
    return 1;
  }

  const dimensionScale = Math.min(
    MAX_EXPORT_CANVAS_DIMENSION / width,
    MAX_EXPORT_CANVAS_DIMENSION / height,
  );
  const areaScale = Math.sqrt(MAX_EXPORT_CANVAS_PIXELS / (width * height));
  const boundedScale = Math.min(preferredScale, dimensionScale, areaScale);

  if (!Number.isFinite(boundedScale)) {
    return 1;
  }

  return Math.max(1, Number(boundedScale.toFixed(2)));
}

function getCanvasFitScale(width, height) {
  if (width <= 0 || height <= 0) {
    return 1;
  }

  const dimensionScale = Math.min(
    1,
    MAX_EXPORT_CANVAS_DIMENSION / width,
    MAX_EXPORT_CANVAS_DIMENSION / height,
  );
  const areaScale = Math.min(
    1,
    Math.sqrt(MAX_EXPORT_CANVAS_PIXELS / (width * height)),
  );

  const boundedScale = Math.min(dimensionScale, areaScale);

  if (!Number.isFinite(boundedScale)) {
    return 1;
  }

  return Math.max(0.01, Number(boundedScale.toFixed(4)));
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

function getCommentEntryCount(comment) {
  return 1 + (comment?.replies?.length || 0);
}

function splitCommentsForExport(comments, maxEntriesPerChunk = CHAT_EXPORT_CHUNK_SIZE) {
  const safeLimit = Number(maxEntriesPerChunk) > 0 ? Number(maxEntriesPerChunk) : CHAT_EXPORT_CHUNK_SIZE;
  const chunks = [];
  let currentChunk = [];
  let currentEntryCount = 0;

  comments.forEach((comment) => {
    const replies = comment?.replies || [];
    const threadEntryCount = getCommentEntryCount(comment);

    if (threadEntryCount > safeLimit) {
      if (currentChunk.length) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentEntryCount = 0;
      }

      let replyStart = 0;
      while (replyStart < replies.length) {
        const maxRepliesInChunk = Math.max(1, safeLimit - 1);
        const replySlice = replies.slice(replyStart, replyStart + maxRepliesInChunk);

        chunks.push([
          {
            ...comment,
            replies: replySlice,
          },
        ]);

        replyStart += maxRepliesInChunk;
      }

      return;
    }

    if (currentEntryCount > 0 && currentEntryCount + threadEntryCount > safeLimit) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentEntryCount = 0;
    }

    currentChunk.push(comment);
    currentEntryCount += threadEntryCount;
  });

  if (currentChunk.length || !chunks.length) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function chunkItems(items, maxItemsPerChunk = CHAT_EXPORT_CHUNK_SIZE) {
  const safeLimit = Number(maxItemsPerChunk) > 0 ? Number(maxItemsPerChunk) : CHAT_EXPORT_CHUNK_SIZE;
  const chunks = [];

  for (let index = 0; index < items.length; index += safeLimit) {
    chunks.push(items.slice(index, index + safeLimit));
  }

  return chunks.length ? chunks : [[]];
}

function getCardsWithNotes(boardCards = []) {
  return sortCardsForExport(boardCards).filter((card) =>
    hasMessage(card?.comment?.message),
  );
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
  boardCards = [],
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

  const cardsWithComments = getCardsWithNotes(boardCards);

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
    const { width, height } = getCaptureDimensions(node);
    return await domtoimage.toPng(node, {
      cacheBust: true,
      bgcolor: "#f5efe2",
      scale: getBoundedExportScale(width, height),
    });
  } finally {
    stage.remove();
  }
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function createZipEntryDate(date = new Date()) {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ),
  );
}

async function createZipFromImages(files) {
  const zip = new JSZip();
  const entryDate = createZipEntryDate();

  await Promise.all(
    files.map(async (file) => {
      zip.file(file.name, await dataUrlToBlob(file.dataUrl), {
        date: entryDate,
      });
    }),
  );

  return zip.generateAsync({ type: "blob" });
}

function resolveBoardCaptureNode(board) {
  if (!board) {
    return null;
  }

  if (board.classList?.contains("hive-board__canvas")) {
    return board;
  }

  return board.querySelector(".hive-board__canvas") || board;
}

function normalizePreviewCardsFromBoardData(boardData) {
  const cards = Array.isArray(boardData?.boardCards) ? boardData.boardCards : [];

  return cards
    .filter((card) => card && typeof card === "object")
    .map((card) => ({
      id: String(card.id ?? "").trim(),
      title: String(card.title || "").trim(),
      category: String(card.category || "free").trim(),
      x: Number(card?.position?.x ?? 0),
      y: Number(card?.position?.y ?? 0),
    }))
    .filter((card) => Number.isFinite(card.x) && Number.isFinite(card.y));
}

function getPreviewCategoryFill(category) {
  switch (category) {
    case "visees":
      return "#009F8C";
    case "conditions-enseignant":
      return "#EF7D00";
    case "conditions-equipe":
      return "#AD498D";
    case "domaine":
      return "#E73458";
    case "recommandations-enseignant":
    case "recommandations-equipe":
      return "#F7F3EE";
    case "free":
      return "#FFFFFF";
    default:
      return "#F7F3EE";
  }
}

function getPreviewCategoryStroke(category) {
  if (category === "recommandations-enseignant") {
    return "#EF7D00";
  }

  if (category === "recommandations-equipe") {
    return "#AD498D";
  }

  if (category === "free") {
    return "#8BB31D";
  }

  return "rgba(32, 29, 24, 0.14)";
}

function getPreviewCategoryTextColor(category) {
  if (category === "recommandations-enseignant") {
    return "#EF7D00";
  }

  if (category === "recommandations-equipe") {
    return "#AD498D";
  }

  if (category === "free") {
    return "#8BB31D";
  }

  return "#ffffff";
}

function drawWrappedCenteredText(context, text, centerX, startY, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return;
  }

  const lines = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
      return;
    }

    lines.push(line);
    line = word;
  });

  if (line) {
    lines.push(line);
  }

  lines.slice(0, maxLines).forEach((entry, index) => {
    const text = index === maxLines - 1 && lines.length > maxLines
      ? `${entry.replace(/\s+\S+$/, "")}...`
      : entry;
    context.fillText(text, centerX, startY + index * lineHeight);
  });
}

function getCardIconCandidates(card) {
  if (card.category === "free") {
    return ["/data/icons/free.png"];
  }

  const id = String(card.id || "").trim();
  if (!id) {
    return ["/data/icons/free.png"];
  }

  const candidates = [`/data/icons/${id}.png`, `/data/icons/${encodeURIComponent(id)}.png`];
  if (id.endsWith(".")) {
    candidates.push(`/data/icons/${id.slice(0, -1)}.png`);
  }

  return [...new Set(candidates)];
}

function drawHexPath(context, x, y, size) {
  const radius = size / 2;
  const centerX = x + radius;
  const centerY = y + radius;
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 90);
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.closePath();
}

async function loadImageFromCandidates(candidates) {
  for (const candidate of candidates) {
    try {
      const resolvedUrl = new URL(candidate, window.location.href).toString();
      const response = await fetch(resolvedUrl, { cache: "force-cache" });
      if (!response.ok) {
        continue;
      }

      const dataUrl = await blobToDataUrl(await response.blob());
      return await loadImage(dataUrl);
    } catch {
      // Try next source.
    }
  }

  return null;
}

export async function renderBoardPreviewFromData(boardData, { maxWidth, maxHeight }) {
  const cards = normalizePreviewCardsFromBoardData(boardData);
  if (!cards.length) {
    return null;
  }

  const leftBound = Math.max(
    0,
    Math.min(...cards.map((card) => card.x)) - BOARD_CAPTURE_PADDING,
  );
  const topBound = Math.max(
    0,
    Math.min(...cards.map((card) => card.y)) - BOARD_CAPTURE_PADDING,
  );
  const rightBound = Math.min(
    PREVIEW_BOARD_WIDTH,
    Math.max(...cards.map((card) => card.x + PREVIEW_CARD_SIZE)) + BOARD_CAPTURE_PADDING,
  );
  const bottomBound = Math.min(
    PREVIEW_BOARD_HEIGHT,
    Math.max(...cards.map((card) => card.y + PREVIEW_CARD_SIZE)) + BOARD_CAPTURE_PADDING,
  );

  const regionWidth = Math.max(1, rightBound - leftBound);
  const regionHeight = Math.max(1, bottomBound - topBound);
  const fitScale = Math.min(maxWidth / regionWidth, maxHeight / regionHeight, 1);
  const width = Math.max(1, Math.round(regionWidth * fitScale));
  const height = Math.max(1, Math.round(regionHeight * fitScale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to render board preview");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const iconById = new Map();
  await Promise.all(
    cards.map(async (card) => {
      const image = await loadImageFromCandidates(getCardIconCandidates(card));
      iconById.set(card.id, image);
    }),
  );

  cards.forEach((card) => {
    const x = Math.round((card.x - leftBound) * fitScale);
    const y = Math.round((card.y - topBound) * fitScale);
    const size = Math.max(28, Math.round(PREVIEW_CARD_SIZE * fitScale));
    const centerX = Math.round(x + size / 2);
    const textColor = getPreviewCategoryTextColor(card.category);

    drawHexPath(context, x, y, size);
    context.fillStyle = getPreviewCategoryFill(card.category);
    context.fill();

    context.lineWidth = Math.max(1, Math.round(2 * fitScale));
    context.strokeStyle = getPreviewCategoryStroke(card.category);

    if (
      card.category === "recommandations-enseignant" ||
      card.category === "recommandations-equipe" ||
      card.category === "free"
    ) {
      context.setLineDash([
        Math.max(3, Math.round(size * 0.08)),
        Math.max(2, Math.round(size * 0.05)),
      ]);
    } else {
      context.setLineDash([]);
    }

    context.stroke();
    context.setLineDash([]);

    context.fillStyle = textColor;
    context.textAlign = "center";
    context.textBaseline = "middle";

    if (card.category !== "free") {
      const idFontSize = Math.max(8, Math.round(size * PREVIEW_FRONT_LAYOUT.idFontSize));
      context.font = `700 ${idFontSize}px "Poppins", "Segoe UI", sans-serif`;
      context.fillText(card.id, centerX, y + Math.round(size * PREVIEW_FRONT_LAYOUT.idY));
    }

    const titleFontSize = Math.max(7, Math.round(size * PREVIEW_FRONT_LAYOUT.titleFontSize));
    context.font = `600 ${titleFontSize}px "Poppins", "Segoe UI", sans-serif`;
    const titleY = card.category === "free" 
      ? y + Math.round(size * 0.30)
      : y + Math.round(size * PREVIEW_FRONT_LAYOUT.titleStartY);
    drawWrappedCenteredText(
      context,
      card.title,
      centerX,
      titleY,
      Math.round(size * PREVIEW_FRONT_LAYOUT.titleMaxWidth),
      Math.max(9, Math.round(size * PREVIEW_FRONT_LAYOUT.titleLineHeight)),
      PREVIEW_FRONT_LAYOUT.titleMaxLines,
    );

    const icon = iconById.get(card.id);
    if (icon) {
      const iconSize = Math.max(10, Math.round(size * PREVIEW_FRONT_LAYOUT.iconSize));
      const iconX = Math.round(x + size / 2 - iconSize / 2);
      const iconY = card.category === "free"
        ? Math.round(y + size * 0.58 - iconSize / 2)
        : Math.round(y + size * PREVIEW_FRONT_LAYOUT.iconCenterY - iconSize / 2);
      context.drawImage(icon, iconX, iconY, iconSize, iconSize);
    }
  });

  return canvas;
}

function getCaptureDimensions(node) {
  const rect = node.getBoundingClientRect();
  const width = Math.max(
    Math.ceil(rect.width),
    node.scrollWidth || 0,
    node.clientWidth || 0,
    node.offsetWidth || 0,
  );
  const height = Math.max(
    Math.ceil(rect.height),
    node.scrollHeight || 0,
    node.clientHeight || 0,
    node.offsetHeight || 0,
  );

  return {
    width,
    height,
  };
}

function getRenderedBoardBounds(node) {
  const nodeRect = node.getBoundingClientRect();
  const cards = [...node.querySelectorAll(".draggable-card")];

  if (!cards.length) {
    return null;
  }

  return cards.reduce((bounds, card) => {
    const rect = card.getBoundingClientRect();
    const nextBounds = {
      left: Math.max(0, rect.left - nodeRect.left),
      top: Math.max(0, rect.top - nodeRect.top),
      right: Math.max(0, rect.right - nodeRect.left),
      bottom: Math.max(0, rect.bottom - nodeRect.top),
    };

    if (!bounds) {
      return nextBounds;
    }

    return {
      left: Math.min(bounds.left, nextBounds.left),
      top: Math.min(bounds.top, nextBounds.top),
      right: Math.max(bounds.right, nextBounds.right),
      bottom: Math.max(bounds.bottom, nextBounds.bottom),
    };
  }, null);
}

function getCaptureRegion(node) {
  const { width: nodeWidth, height: nodeHeight } = getCaptureDimensions(node);
  const contentBounds = getRenderedBoardBounds(node);

  if (!contentBounds) {
    return {
      left: 0,
      top: 0,
      width: nodeWidth,
      height: nodeHeight,
      nodeWidth,
      nodeHeight,
    };
  }

  const left = Math.max(0, Math.floor(contentBounds.left - BOARD_CAPTURE_PADDING));
  const top = Math.max(0, Math.floor(contentBounds.top - BOARD_CAPTURE_PADDING));
  const right = Math.min(
    nodeWidth,
    Math.ceil(contentBounds.right + BOARD_CAPTURE_PADDING),
  );
  const bottom = Math.min(
    nodeHeight,
    Math.ceil(contentBounds.bottom + BOARD_CAPTURE_PADDING),
  );

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    nodeWidth,
    nodeHeight,
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function waitForImageLoad(image, timeoutMs = 10000) {
  if (image.complete && image.naturalWidth > 0) {
    if (typeof image.decode === "function") {
      return image.decode().catch(() => undefined);
    }

    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(resolve, timeoutMs);

    const handleDone = () => {
      window.clearTimeout(timeoutId);
      image.removeEventListener("load", handleDone);
      image.removeEventListener("error", handleDone);

      if (typeof image.decode === "function") {
        image.decode().catch(() => undefined).finally(resolve);
        return;
      }

      resolve();
    };

    image.addEventListener("load", handleDone, { once: true });
    image.addEventListener("error", handleDone, { once: true });
  });
}

async function inlineNodeImages(root) {
  const images = [...root.querySelectorAll("img")];

  function getImageCandidateUrls(image) {
    const candidates = [];
    const pushCandidate = (value) => {
      const trimmed = String(value || "").trim();
      if (!trimmed || candidates.includes(trimmed)) {
        return;
      }

      candidates.push(trimmed);
    };

    pushCandidate(image.currentSrc);
    pushCandidate(image.getAttribute("src"));

    const cardId = image
      .closest(".hex-front")
      ?.querySelector("span")
      ?.textContent?.trim();
    if (cardId) {
      pushCandidate(`/data/icons/${cardId}.png`);
      pushCandidate(`/data/icons/${encodeURIComponent(cardId)}.png`);
      if (cardId.endsWith(".")) {
        pushCandidate(`/data/icons/${cardId.slice(0, -1)}.png`);
      }
    }

    return candidates;
  }

  async function tryInlineImage(image, source) {
    const resolvedUrl = new URL(source, window.location.href).toString();
    const response = await fetch(resolvedUrl, { cache: "force-cache" });
    if (!response.ok) {
      return false;
    }

    const blob = await response.blob();
    image.setAttribute("src", await blobToDataUrl(blob));
    await waitForImageLoad(image);

    return image.naturalWidth > 0;
  }

  await Promise.all(
    images.map(async (image) => {
      const candidateUrls = getImageCandidateUrls(image);
      if (!candidateUrls.length) {
        await waitForImageLoad(image);
        return;
      }

      for (const source of candidateUrls) {
        const isDataUrl = source.startsWith("data:");

        if (isDataUrl) {
          image.setAttribute("src", source);
          await waitForImageLoad(image);
          if (image.naturalWidth > 0) {
            return;
          }

          continue;
        }

        try {
          const didInline = await tryInlineImage(image, source);
          if (didInline) {
            return;
          }
        } catch {
          // Try next candidate source.
        }
      }

      await waitForImageLoad(image);
    }),
  );
}

async function captureNodeImage(node, options = {}) {
  const region = getCaptureRegion(node);
  const scale = getBoundedExportScale(region.width, region.height);
  const stage = createElement("div", { styles: EXPORT_STAGE_STYLE });
  const frame = createElement("div", {
    styles: {
      position: "relative",
      width: `${region.width}px`,
      height: `${region.height}px`,
      overflow: "hidden",
    },
  });
  const clone = node.cloneNode(true);

  applyStyles(clone, {
    position: "absolute",
    left: `-${region.left}px`,
    top: `-${region.top}px`,
    width: `${region.nodeWidth}px`,
    height: `${region.nodeHeight}px`,
    maxWidth: "none",
    margin: "0",
  });

  frame.appendChild(clone);
  stage.appendChild(frame);
  document.body.appendChild(stage);

  try {
    await inlineNodeImages(clone);
    await waitForCaptureFrame();
    return await domtoimage.toPng(frame, {
      cacheBust: true,
      width: region.width,
      height: region.height,
      scale,
      ...options,
    });
  } finally {
    stage.remove();
  }
}

async function captureBoardImages(board) {
  const captureNode = resolveBoardCaptureNode(board);

  if (!captureNode) {
    throw new Error("Board not found");
  }

  document.body.classList.add("capture-mode");

  try {
    await waitForCaptureFrame();

    const frontDataUrl = await captureNodeImage(captureNode);

    document.body.classList.add("capture-mode-back");
    await waitForCaptureFrame();

    const backDataUrl = await captureNodeImage(captureNode);

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
  const mergedWidth = Math.max(frontImage.width, backImage.width);
  const mergedHeight = frontImage.height + backImage.height + spacing;
  const fitScale = getCanvasFitScale(mergedWidth, mergedHeight);
  const canvasWidth = Math.max(1, Math.round(mergedWidth * fitScale));
  const canvasHeight = Math.max(1, Math.round(mergedHeight * fitScale));
  const scaledSpacing = Math.round(spacing * fitScale);
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(mergeErrorMessage);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    frontImage,
    0,
    0,
    Math.round(frontImage.width * fitScale),
    Math.round(frontImage.height * fitScale),
  );
  context.drawImage(
    backImage,
    0,
    Math.round(frontImage.height * fitScale) + scaledSpacing,
    Math.round(backImage.width * fitScale),
    Math.round(backImage.height * fitScale),
  );

  return canvas.toDataURL("image/png");
}

export async function captureBoardFrontAndBack(board, mergeErrorMessage) {
  const { frontDataUrl, backDataUrl } = await captureBoardImages(board);

  return mergeFrontAndBackCapture(frontDataUrl, backDataUrl, mergeErrorMessage);
}

export async function captureBoardPreviewImage(board, options = {}) {
  const captureNode = resolveBoardCaptureNode(board);
  const maxWidth = Number(options.maxWidth) > 0 ? Number(options.maxWidth) : 800;
  const maxHeight = Number(options.maxHeight) > 0 ? Number(options.maxHeight) : 450;
  const sourceScale = Number.isFinite(Number(options.sourceScale))
    ? Math.min(3, Math.max(1, Number(options.sourceScale)))
    : 2;
  const quality = Number.isFinite(Number(options.quality))
    ? Math.min(1, Math.max(0.1, Number(options.quality)))
    : 0.76;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : 170 * 1024;
  const boardData = options.boardData;

  function getDataUrlBytes(dataUrl) {
    const payload = String(dataUrl || "").split(",")[1] || "";
    return Math.floor((payload.length * 3) / 4);
  }

  function supportsCanvasMimeType(canvas, mimeType) {
    try {
      return canvas
        .toDataURL(mimeType, quality)
        .startsWith(`data:${mimeType};base64,`);
    } catch {
      return false;
    }
  }

  function encodeCanvas(canvas, mimeType, candidateQuality) {
    if (mimeType === "image/png") {
      return canvas.toDataURL(mimeType);
    }

    return canvas.toDataURL(mimeType, candidateQuality);
  }

  function encodeWithinBudget(canvas) {
    const mimeType = supportsCanvasMimeType(canvas, "image/webp")
      ? "image/webp"
      : supportsCanvasMimeType(canvas, "image/jpeg")
        ? "image/jpeg"
        : "image/png";
    let candidateQuality = quality;

    let dataUrl = encodeCanvas(canvas, mimeType, candidateQuality);

    if (mimeType === "image/png") {
      return dataUrl;
    }

    while (getDataUrlBytes(dataUrl) > maxBytes && candidateQuality > 0.45) {
      candidateQuality = Number((candidateQuality - 0.06).toFixed(2));
      dataUrl = encodeCanvas(canvas, mimeType, candidateQuality);
    }

    return dataUrl;
  }

  if (!captureNode) {
    throw new Error("Board not found");
  }

  document.body.classList.add("capture-mode");

  try {
    await waitForCaptureFrame();

    const sourceDataUrl = await captureNodeImage(captureNode, {
      scale: sourceScale,
    });
    const image = await loadImage(sourceDataUrl);

    const fitScale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = Math.max(1, Math.round(image.width * fitScale));
    const height = Math.max(1, Math.round(image.height * fitScale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to render board preview");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    return encodeWithinBudget(canvas);
  } catch (error) {
    if (boardData) {
      try {
        const renderedCanvas = await renderBoardPreviewFromData(boardData, {
          maxWidth,
          maxHeight,
        });

        if (renderedCanvas) {
          return encodeWithinBudget(renderedCanvas);
        }
      } catch {
        // Re-throw the original DOM capture failure below.
      }
    }

    throw error;
  } finally {
    document.body.classList.remove("capture-mode");
  }
}

export async function captureHiveExportBundle({
  board,
  title,
  comments = [],
  boardCards = [],
  frontBoardFileName,
  backBoardFileName,
  chatFileName,
  cardNotesFileName,
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
  const chatCommentChunks = splitCommentsForExport(comments, CHAT_EXPORT_CHUNK_SIZE);
  const chatDataUrls = await Promise.all(
    chatCommentChunks.map((commentChunk) =>
      captureDetachedNode(
        createChatExportNode({
          comments: commentChunk,
          chatTitle,
          noCommentsMessage,
          formatDateTime,
          unknownUserLabel,
        }),
      ),
    ),
  );
  const cardNotesChunks = chunkItems(getCardsWithNotes(boardCards), CHAT_EXPORT_CHUNK_SIZE);
  const cardCommentsDataUrls = await Promise.all(
    cardNotesChunks.map((cardsChunk) =>
      captureDetachedNode(
        createCardNotesExportNode({
          boardCards: cardsChunk,
          cardNotesTitle,
          noCardNotesMessage,
          cardLabel,
          unknownUserLabel,
          formatCreatedByText,
          formatUpdatedByText,
        }),
      ),
    ),
  );

  const resolvedFrontBoardFileName =
    sanitizeSnapshotFileName(frontBoardFileName || "front-board") + ".png";
  const resolvedBackBoardFileName =
    sanitizeSnapshotFileName(backBoardFileName || "back-board") + ".png";
  const resolvedChatBaseFileName = sanitizeSnapshotFileName(chatFileName || "hive-chat");
  const resolvedChatFileNames =
    chatDataUrls.length > 1
      ? chatDataUrls.map((_, index) => `${resolvedChatBaseFileName} (${index + 1}).png`)
      : [`${resolvedChatBaseFileName}.png`];
  const resolvedCardNotesBaseFileName = sanitizeSnapshotFileName(
    cardNotesFileName || "card-notes",
  );
  const resolvedCardNotesFileNames =
    cardCommentsDataUrls.length > 1
      ? cardCommentsDataUrls.map(
        (_, index) => `${resolvedCardNotesBaseFileName} (${index + 1}).png`,
      )
      : [`${resolvedCardNotesBaseFileName}.png`];

  const zipFiles = [
    { name: resolvedFrontBoardFileName, dataUrl: frontDataUrl },
    { name: resolvedBackBoardFileName, dataUrl: backDataUrl },
    ...chatDataUrls.map((dataUrl, index) => ({
      name: resolvedChatFileNames[index],
      dataUrl,
    })),
    ...cardCommentsDataUrls.map((dataUrl, index) => ({
      name: resolvedCardNotesFileNames[index],
      dataUrl,
    })),
  ];

  const zipBlob = await createZipFromImages(
    zipFiles.map((file, index) => ({
      name: `${String(index + 1).padStart(2, "0")}-${file.name}`,
      dataUrl: file.dataUrl,
    })),
  );

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