import HexCard from "./HexCard";
import FreeHexCard from "./FreeSpaceCard";
import { useDraggableCard } from "../hooks/useDraggableCard";

export default function DraggableCard({
  card,
  boardRef,
  onMoveCard,
  onReturnToLibrary,
}) {
  const { cardRef, position, isDragging, handleMouseDown, handleTouchStart } =
    useDraggableCard(card, boardRef, 140, 140, onMoveCard, onReturnToLibrary);

  return (
    <div
      ref={cardRef}
      className={`draggable-card ${isDragging ? "dragging" : ""}`}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        zIndex: 1000,
        width: "140px",
        height: "140px",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {card.category === "free" ? (
        <FreeHexCard card={card} />
      ) : (
        <HexCard card={card} />
      )}
    </div>
  );
}
