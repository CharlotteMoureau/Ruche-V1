import { useDragLayer } from "react-dnd";
import HexCard from "./HexCard";
import { BOARD_CARD_SIZE } from "../lib/board";

const layerStyles = {
  position: "fixed",
  pointerEvents: "none",
  zIndex: 10000,
  left: 0,
  top: 0,
};

export default function CustomDragPreview({ zoom = 1 }) {
  const { item, isDragging, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getClientOffset(),
  }));

  if (!isDragging || !currentOffset) return null;
  const { x, y } = currentOffset;

  return (
    <div style={{ ...layerStyles, transform: `translate(${x}px, ${y}px)` }}>
      <div
        style={{
          "--board-card-size": `${BOARD_CARD_SIZE}px`,
          transform: `translate(-50%, -50%) scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        <HexCard card={item.card} onlyFront />
      </div>
    </div>
  );
}
