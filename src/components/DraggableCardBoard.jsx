import { useState, useEffect, useRef } from "react";
import HexCard from "./HexCard";

export default function DraggableCardBoard({
  card,
  boardRef,
  onMoveCard,
  onReturnToLibrary,
}) {
  const [position, setPosition] = useState(card.position);
  const cardRef = useRef(null); // Ref vers le div de la carte
  const posRef = useRef(position); // Ref pour drag live
  posRef.current = position;

  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    offsetRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
    document.body.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!draggingRef.current || !cardRef.current) return;
    const newX = e.clientX - offsetRef.current.x;
    const newY = e.clientY - offsetRef.current.y;
    posRef.current = { x: newX, y: newY };
    cardRef.current.style.left = `${newX}px`;
    cardRef.current.style.top = `${newY}px`;
  };

  const handleMouseUp = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.cursor = "default";

    const boardRect = boardRef.current.getBoundingClientRect();
    const finalPos = posRef.current;

    if (
      finalPos.x < 0 ||
      finalPos.x + 140 > boardRect.width ||
      finalPos.y < 0 ||
      finalPos.y + 140 > boardRect.height
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
  }, []);

  useEffect(() => {
    setPosition(card.position);
  }, [card.position]);

  return (
    <div
      ref={cardRef}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        cursor: "grab",
        zIndex: 1000,
      }}
      onMouseDown={handleMouseDown}
    >
      <HexCard card={card} />
    </div>
  );
}
