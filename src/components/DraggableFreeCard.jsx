import { useState, useRef, useEffect } from "react";
import FreeHexCard from "./FreeSpaceCard";

export default function DraggableFreeCard({
  card,
  boardRef,
  onMoveCard,
  onReturnToLibrary,
}) {
  const [position, setPosition] = useState(card.position);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef(null);
  const posRef = useRef(position);
  posRef.current = position;

  const offsetRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !cardRef.current) return;
    const newX = e.clientX - offsetRef.current.x;
    const newY = e.clientY - offsetRef.current.y;
    posRef.current = { x: newX, y: newY };
    cardRef.current.style.left = `${newX}px`;
    cardRef.current.style.top = `${newY}px`;
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const boardRect = boardRef.current.getBoundingClientRect();
    const finalPos = posRef.current;

    if (
      finalPos.x < 0 ||
      finalPos.x + 100 > boardRect.width ||
      finalPos.y < 0 ||
      finalPos.y + 100 > boardRect.height
    ) {
      onReturnToLibrary(card);
    } else {
      setPosition(finalPos);
      onMoveCard(card.id, finalPos);
    }
  };

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  });

  useEffect(() => {
    setPosition(card.position);
  }, [card.position]);

  return (
    <div
      ref={cardRef}
      className={`draggable-card free-space ${isDragging ? "dragging" : ""}`}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        zIndex: 1000,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
    >
      <FreeHexCard card={card} />
    </div>
  );
}
