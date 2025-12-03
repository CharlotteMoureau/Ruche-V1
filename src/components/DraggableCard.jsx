import { useState, useEffect, useRef } from "react";
import HexCard from "./HexCard";
import FreeHexCard from "./FreeSpaceCard";

export default function DraggableCard({
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

  /** Gestion souris **/
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
    finalizePosition();
  };

  /** Gestion tactile **/
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    offsetRef.current = {
      x: touch.clientX - posRef.current.x,
      y: touch.clientY - posRef.current.y,
    };
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !cardRef.current) return;
    const touch = e.touches[0];
    const newX = touch.clientX - offsetRef.current.x;
    const newY = touch.clientY - offsetRef.current.y;
    posRef.current = { x: newX, y: newY };
    cardRef.current.style.left = `${newX}px`;
    cardRef.current.style.top = `${newY}px`;
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    finalizePosition();
  };

  /** Fonction commune pour valider la position **/
  const finalizePosition = () => {
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

  /** Ajout des listeners souris **/
  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  });

  /** Mise à jour si la position change via props **/
  useEffect(() => {
    setPosition(card.position);
  }, [card.position]);

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
