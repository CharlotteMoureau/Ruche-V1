import {
  BOARD_CARD_SIZE,
  BOARD_CANVAS_HEIGHT,
  BOARD_CANVAS_WIDTH,
} from "../lib/board";
import { useDraggableCard } from "../hooks/useDraggableCard";

export default function DraggableBoardCard({
  card,
  className = "",
  isSelected,
  selectedCards,
  zoom,
  onMoveCard,
  onMoveCards,
  onReturnToLibrary,
  onReturnCardsToLibrary,
  onDragStart,
  onToggleSelection,
  onClearSelection,
  isTabletEditorMode = false,
  dragDisabled = false,
  onUnavailableInteraction,
  children,
}) {
  const {
    isDragging,
    isDraggingOverLibrary,
    handleMouseDown,
    handleTouchStart,
  } = useDraggableCard({
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
    onDragStart,
    onToggleSelection,
    onClearSelection,
    isTabletEditorMode,
    dragDisabled,
    onUnavailableInteraction,
  });

  return (
    <div
      className={`draggable-card ${className} ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""}`.trim()}
      style={{
        "--board-card-size": `${BOARD_CARD_SIZE}px`,
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: isDragging || isSelected ? 1100 : 1000,
        width: `${BOARD_CARD_SIZE}px`,
        height: `${BOARD_CARD_SIZE}px`,
        cursor: dragDisabled ? "not-allowed" : isDragging ? "grabbing" : "grab",
        opacity: isDraggingOverLibrary ? 0 : 1,
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
      onMouseDown={(event) => {
        handleMouseDown(event);
      }}
      onTouchStart={(event) => {
        handleTouchStart(event);
      }}
    >
      {children}
    </div>
  );
}
