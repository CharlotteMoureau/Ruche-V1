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
  const longPressTimer = useRef(null);
  const hasMovedBeforeDrag = useRef(false);

  /** Détection iOS + Safari **/
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS en mode desktop
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

  /** Gestion souris (PC) → drag immédiat **/
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
    hasMovedBeforeDrag.current = false;

    if (isIOS && isSafari) {
      // Sur iOS Safari → long press avant drag
      longPressTimer.current = setTimeout(() => {
        if (!hasMovedBeforeDrag.current) {
          setIsDragging(true);
          offsetRef.current = {
            x: touch.clientX - posRef.current.x,
            y: touch.clientY - posRef.current.y,
          };
        }
      }, 400); // 400ms pour long press
    } else {
      // Autres mobiles → drag immédiat
      setIsDragging(true);
      offsetRef.current = {
        x: touch.clientX - posRef.current.x,
        y: touch.clientY - posRef.current.y,
      };
    }
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];

    // Si on bouge avant la fin du long press → annuler
    if (!isDragging && longPressTimer.current) {
      hasMovedBeforeDrag.current = true;
      clearTimeout(longPressTimer.current);
      return; // Laisse le scroll se faire
    }

    if (!isDragging || !cardRef.current) return;

    const newX = touch.clientX - offsetRef.current.x;
    const newY = touch.clientY - offsetRef.current.y;
    posRef.current = { x: newX, y: newY };
    cardRef.current.style.left = `${newX}px`;
    cardRef.current.style.top = `${newY}px`;
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
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

  /** Listeners globaux **/
  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  });

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
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        // IMPORTANT : ne pas mettre touchAction: none pour garder le scroll
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
