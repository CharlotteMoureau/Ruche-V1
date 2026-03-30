import HexCard from "./HexCard";
import FreeHexCard from "./FreeSpaceCard";
import { useDraggableCard } from "../hooks/useDraggableCard";
import {
  BOARD_CARD_SIZE,
  BOARD_CANVAS_HEIGHT,
  BOARD_CANVAS_WIDTH,
} from "../lib/board";

export default function DraggableCard({
  card,
  isSelected,
  selectedCards,
  zoom,
  onMoveCard,
  onMoveCards,
  onReturnToLibrary,
  onReturnCardsToLibrary,
  onToggleSelection,
  onClearSelection,
}) {
  const { isDragging, handleMouseDown, handleTouchStart } = useDraggableCard({
    card,
    cardWidth: BOARD_CARD_SIZE,
    cardHeight: BOARD_CARD_SIZE,
    boardWidth: BOARD_CANVAS_WIDTH,
    boardHeight: BOARD_CANVAS_HEIGHT,
    zoom,
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
      className={`draggable-card ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      style={{
        "--board-card-size": `${BOARD_CARD_SIZE}px`,
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: isDragging || isSelected ? 1100 : 1000,
        width: `${BOARD_CARD_SIZE}px`,
        height: `${BOARD_CARD_SIZE}px`,
        cursor: isDragging ? "grabbing" : "grab",
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
