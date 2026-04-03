import { useEffect } from "react";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import HexCard from "./HexCard";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMatchSnippet(card, searchTerm) {
  if (!searchTerm) return "";

  const fields = [
    typeof card.title === "string" ? card.title : "",
    typeof card.definition === "string" ? card.definition : "",
    String(card.id ?? ""),
  ];

  const lowerSearch = searchTerm.toLowerCase();

  for (const field of fields) {
    const lowerField = field.toLowerCase();
    const matchIndex = lowerField.indexOf(lowerSearch);
    if (matchIndex === -1) continue;

    const start = Math.max(0, matchIndex - 20);
    const end = Math.min(field.length, matchIndex + searchTerm.length + 28);
    const snippet = field.slice(start, end).trim();
    const prefix = start > 0 ? "..." : "";
    const suffix = end < field.length ? "..." : "";

    return `${prefix}${snippet}${suffix}`;
  }

  return "";
}

function renderHighlightedText(text, searchTerm) {
  if (!text || !searchTerm) return text;

  const pattern = new RegExp(`(${escapeRegExp(searchTerm)})`, "ig");
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (part.toLowerCase() === searchTerm.toLowerCase()) {
      return <mark key={`match-${index}`}>{part}</mark>;
    }

    return <span key={`text-${index}`}>{part}</span>;
  });
}

/**
 * LibraryCard - Draggable card for the library sidebar
 * Extracted to prevent unnecessary re-renders of parent component
 */
function LibraryCard({
  card,
  searchTerm = "",
  isSearchActive = false,
  isTabletSelectable = false,
  isSelected = false,
  onToggleSelect,
}) {
  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type: "CARD",
      item: { card, fromLibrary: true },
      canDrag: !isTabletSelectable,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [card, isTabletSelectable],
  );

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  const matchSnippet = getMatchSnippet(card, searchTerm);

  return (
    <div
      ref={drag}
      className={`library-card ${isDragging ? "dragging" : ""} ${
        isSearchActive ? "library-card--match" : ""
      } ${isSelected ? "library-card--selected" : ""}`}
      style={{
        opacity: isDragging ? 0.4 : 1,
        cursor: isTabletSelectable
          ? "pointer"
          : isDragging
            ? "grabbing"
            : "grab",
      }}
      onClick={() => {
        if (!isTabletSelectable) return;
        onToggleSelect?.(card.id);
      }}
    >
      <HexCard card={card} />
      {isSearchActive && matchSnippet ? (
        <p className="library-card__match-snippet">
          {renderHighlightedText(matchSnippet, searchTerm)}
        </p>
      ) : null}
    </div>
  );
}

export default LibraryCard;
