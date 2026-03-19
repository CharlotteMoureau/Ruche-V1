import { useEffect } from "react";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import HexCard from "./HexCard";

/**
 * LibraryCard - Draggable card for the library sidebar
 * Extracted to prevent unnecessary re-renders of parent component
 */
function LibraryCard({ card }) {
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: "CARD",
    item: { card, fromLibrary: true },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  return (
    <div
      ref={drag}
      className={`library-card ${isDragging ? "dragging" : ""}`}
      style={{
        opacity: isDragging ? 0.4 : 1,
        margin: "4px",
        cursor: isDragging ? "grabbing" : "grab",
      }}
    >
      <HexCard card={card} />
    </div>
  );
}

export default LibraryCard;
