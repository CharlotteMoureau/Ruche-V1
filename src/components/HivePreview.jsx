function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeSnapshot(snapshot) {
  if (!Array.isArray(snapshot)) return [];

  return snapshot
    .filter((card) => card && typeof card === "object")
    .map((card, index) => ({
      id: String(card.id ?? `card-${index}`),
      title:
        typeof card.title === "string" && card.title.trim()
          ? card.title.trim()
          : "...",
      category: typeof card.category === "string" ? card.category : "free",
      x: toFiniteNumber(card.x),
      y: toFiniteNumber(card.y),
    }));
}

function getCategoryClass(category) {
  switch (category) {
    case "visees":
      return "category-visees";
    case "conditions-enseignant":
      return "category-conditions-enseignant";
    case "recommandations-enseignant":
      return "category-recommandations-enseignant";
    case "conditions-equipe":
      return "category-conditions-equipe";
    case "recommandations-equipe":
      return "category-recommandations-equipe";
    case "domaine":
      return "category-domaine";
    default:
      return "category-free";
  }
}

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

  return /^data:image\/(webp|jpeg|jpg|png);base64,/i.test(trimmed);
}

export default function HivePreview({ previewImage, snapshot, emptyLabel }) {
  if (shouldRenderPreviewImage(previewImage)) {
    return (
      <img
        src={previewImage}
        alt={emptyLabel}
        className="hive-preview-image"
        loading="lazy"
      />
    );
  }

  const cards = normalizeSnapshot(snapshot);

  if (!cards.length) {
    return <p className="hive-preview-empty">{emptyLabel}</p>;
  }

  const xs = cards.map((card) => card.x);
  const ys = cards.map((card) => card.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;

  return (
    <div className="hive-preview-board" aria-label="Hive board preview">
      {cards.slice(0, 12).map((card) => {
        const left = rangeX > 0 ? ((card.x - minX) / rangeX) * 100 : 50;
        const top = rangeY > 0 ? ((card.y - minY) / rangeY) * 100 : 50;
        const categoryClass = getCategoryClass(card.category);

        return (
          <div
            key={card.id}
            className={`hive-preview-card ${categoryClass}`}
            style={{ left: `${left}%`, top: `${top}%` }}
            title={card.title}
          >
            <span>{card.title}</span>
          </div>
        );
      })}
    </div>
  );
}
