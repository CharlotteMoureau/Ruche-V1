import FreeHexCard from "./FreeSpaceCard";
import { useDraggableCard } from "../hooks/useDraggableCard";

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
}) {
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
      <FreeHexCard card={card} />
    </div>
  );
}
