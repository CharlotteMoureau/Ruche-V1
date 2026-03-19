import FreeHexCard from "./FreeSpaceCard";
import { useDraggableCard } from "../hooks/useDraggableCard";

export default function DraggableFreeCard({
  card,
  boardRef,
  onMoveCard,
  onReturnToLibrary,
}) {
  const { cardRef, position, isDragging, handleMouseDown, handleTouchStart } =
    useDraggableCard(card, boardRef, 100, 100, onMoveCard, onReturnToLibrary);

  return (
    <div
      ref={cardRef}
      className={`draggable-card free-space ${isDragging ? "dragging" : ""}`}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        zIndex: 1000,
        width: "100px",
        height: "100px",
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <FreeHexCard card={card} />
    </div>
  );
}
