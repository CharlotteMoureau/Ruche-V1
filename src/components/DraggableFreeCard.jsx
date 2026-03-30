import FreeHexCard from "./FreeSpaceCard";
import { useDraggableCard } from "../hooks/useDraggableCard";
import { useLanguage } from "../context/LanguageContext";

export default function DraggableFreeCard({
  card,
  boardRef,
  isSelected,
  selectedCards,
  onMoveCard,
  onMoveCards,
  onReturnToLibrary,
  onReturnCardsToLibrary,
  onToggleSelection,
  onClearSelection,
  onOpenNote,
  noteLocked = false,
}) {
  const { t } = useLanguage();
  const { isDragging, handleMouseDown, handleTouchStart } = useDraggableCard({
    card,
    boardRef,
    cardWidth: 200,
    cardHeight: 200,
    isSelected,
    selectedCards,
    onMoveCard,
    onMoveCards,
    onReturnToLibrary,
    onReturnCardsToLibrary,
    onToggleSelection,
    onClearSelection,
  });
  const hasNote = Boolean(card?.comment?.message?.trim());

  return (
    <div
      className={`draggable-card free-space ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      style={{
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: isDragging || isSelected ? 1100 : 1000,
        width: "200px",
        height: "200px",
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <button
        type="button"
        className={`card-note-indicator ${hasNote ? "has-note" : ""} ${noteLocked ? "is-locked" : ""}`.trim()}
        aria-label={t("workspace.cardNoteTitle")}
        aria-disabled={noteLocked}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onTouchStart={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onOpenNote?.(card);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M4 4h16v11H8l-4 4V4zm2 2v8.17L7.17 13H18V6H6z"
            fill="currentColor"
          />
        </svg>
      </button>
      <FreeHexCard card={card} />
    </div>
  );
}
