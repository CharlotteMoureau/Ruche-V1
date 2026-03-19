import { useState, useRef, useEffect, useCallback } from "react";
import { useDeviceDetection } from "./useDeviceDetection";

/**
 * Shared hook for draggable card logic
 * Handles mouse and touch interactions for both regular and free cards
 */
export function useDraggableCard(
  card,
  boardRef,
  cardHeight,
  cardWidth,
  onMoveCard,
  onReturnToLibrary
) {
  const { isIOS, isSafari } = useDeviceDetection();
  const [position, setPosition] = useState(card.position);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef(null);
  const posRef = useRef(position);
  posRef.current = position;

  const offsetRef = useRef({ x: 0, y: 0 });
  const longPressTimer = useRef(null);
  const hasMovedBeforeDrag = useRef(false);

  // Memoize handler functions to prevent unnecessary recreations
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !cardRef.current) return;
    const newX = e.clientX - offsetRef.current.x;
    const newY = e.clientY - offsetRef.current.y;
    posRef.current = { x: newX, y: newY };
    cardRef.current.style.left = `${newX}px`;
    cardRef.current.style.top = `${newY}px`;
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    finalizePosition();
  }, [isDragging]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    hasMovedBeforeDrag.current = false;

    if (isIOS && isSafari) {
      longPressTimer.current = setTimeout(() => {
        if (!hasMovedBeforeDrag.current) {
          setIsDragging(true);
          offsetRef.current = {
            x: touch.clientX - posRef.current.x,
            y: touch.clientY - posRef.current.y,
          };
        }
      }, 400);
    } else {
      setIsDragging(true);
      offsetRef.current = {
        x: touch.clientX - posRef.current.x,
        y: touch.clientY - posRef.current.y,
      };
    }
  }, [isIOS, isSafari]);

  const handleTouchMove = useCallback((e) => {
    const touch = e.touches[0];

    if (!isDragging && longPressTimer.current) {
      hasMovedBeforeDrag.current = true;
      clearTimeout(longPressTimer.current);
      return;
    }

    if (!isDragging || !cardRef.current) return;

    const newX = touch.clientX - offsetRef.current.x;
    const newY = touch.clientY - offsetRef.current.y;
    posRef.current = { x: newX, y: newY };
    cardRef.current.style.left = `${newX}px`;
    cardRef.current.style.top = `${newY}px`;
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    if (!isDragging) return;
    setIsDragging(false);
    finalizePosition();
  }, [isDragging]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalizePosition = useCallback(() => {
    const boardRect = boardRef.current.getBoundingClientRect();
    const finalPos = posRef.current;

    if (
      finalPos.x < 0 ||
      finalPos.x + cardWidth > boardRect.width ||
      finalPos.y < 0 ||
      finalPos.y + cardHeight > boardRect.height
    ) {
      onReturnToLibrary(card);
    } else {
      setPosition(finalPos);
      onMoveCard(card.id, finalPos);
    }
  }, [cardHeight, cardWidth, onMoveCard, onReturnToLibrary, card, boardRef]);

  // Setup global event listeners with proper cleanup
  useEffect(() => {
    const options = { passive: false };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, options);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove, options);
      document.removeEventListener("touchend", handleTouchEnd);
      clearTimeout(longPressTimer.current);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Update position when card.position prop changes
  useEffect(() => {
    setPosition(card.position);
  }, [card.position]);

  return {
    cardRef,
    position,
    isDragging,
    handleMouseDown,
    handleTouchStart,
  };
}
