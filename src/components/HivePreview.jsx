function shouldRenderPreviewImage(previewImage) {
  if (typeof previewImage !== "string") {
    return false;
  }

  const trimmed = previewImage.trim();
  if (!trimmed) {
    return false;
  }

  if (!trimmed.startsWith("data:")) {
    return true;
  }

  return /^data:image\/(webp|jpeg|jpg|png);base64,/i.test(trimmed)
    || /^data:image\/svg\+xml[;,]/i.test(trimmed);
}

function parseSnapshot(snapshot) {
  if (!snapshot) return [];

  const parsed =
    typeof snapshot === "string"
      ? (() => {
          try {
            return JSON.parse(snapshot);
          } catch {
            return [];
          }
        })()
      : snapshot;

  return Array.isArray(parsed) ? parsed : [];
}

function toSafeText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .trim();
}

function buildSnapshotPreviewImage(snapshot, emptyLabel) {
  const cards = parseSnapshot(snapshot)
    .filter((card) => card && typeof card === "object")
    .slice(0, 28);

  if (cards.length === 0) {
    return null;
  }

  const width = 320;
  const height = 180;
  const cardWidth = 72;
  const cardHeight = 36;
  const padding = 16;

  const maxX = Math.max(
    1,
    ...cards.map((card) => Number(card?.x) || 0),
  );
  const maxY = Math.max(
    1,
    ...cards.map((card) => Number(card?.y) || 0),
  );

  const availableWidth = width - padding * 2 - cardWidth;
  const availableHeight = height - padding * 2 - cardHeight;

  const svgCards = cards
    .map((card, index) => {
      const normalizedX = Math.max(0, Math.min(1, (Number(card?.x) || 0) / maxX));
      const normalizedY = Math.max(0, Math.min(1, (Number(card?.y) || 0) / maxY));
      const x = Math.round(padding + normalizedX * availableWidth);
      const y = Math.round(padding + normalizedY * availableHeight);
      const label = toSafeText(card?.title || card?.id || `Card ${index + 1}`);

      return `<g>
        <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="#fff8e7" stroke="#dfc98f" stroke-width="1.2" />
        <text x="${x + 8}" y="${y + 21}" font-size="10" fill="#4a3a23" font-family="Arial, sans-serif">${label.slice(0, 18)}</text>
      </g>`;
    })
    .join("");

  const safeAlt = toSafeText(emptyLabel || "Hive preview");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f3ead7" />
        <stop offset="100%" stop-color="#e8dcc2" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)" rx="12" />
    <title>${safeAlt}</title>
    ${svgCards}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function HivePreview({ previewImage, snapshot, emptyLabel }) {
  const resolvedPreviewImage = shouldRenderPreviewImage(previewImage)
    ? previewImage
    : buildSnapshotPreviewImage(snapshot, emptyLabel);

  if (resolvedPreviewImage) {
    return (
      <img
        src={resolvedPreviewImage}
        alt={emptyLabel}
        className="hive-preview-image"
        loading="lazy"
      />
    );
  }

  return <p className="hive-preview-empty">{emptyLabel}</p>;
}
