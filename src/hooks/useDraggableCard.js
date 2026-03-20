import { useState, useRef, useEffect, useCallback } from "react";
import { useDeviceDetection } from "./useDeviceDetection";

function getCardDimensions() {
  return { width: 200, height: 200 };
}

function isCardOutsideBoard(position, width, height, boardRect) {
  return (
    position.x < 0 ||
    position.y < 0 ||
    position.x + width > boardRect.width ||
    position.y + height > boardRect.height
  );
}

export function useDraggableCard({
  card,
  boardRef,
  cardWidth,
  cardHeight,
  isSelected,
  selectedCards,
  onMoveCard,
  onMoveCards,
  onReturnToLibrary,
  onReturnCardsToLibrary,
  onToggleSelection,
  onClearSelection,
}) {
  const { isIOS, isSafari } = useDeviceDetection();
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef(null);
  const longPressTimer = useRef(null);
  const hasMovedBeforeDrag = useRef(false);

  const updateDraggedCards = useCallback((clientX, clientY) => {
    if (!dragStateRef.current) return;

    const delta = {
      x: clientX - dragStateRef.current.startPointer.x,
      y: clientY - dragStateRef.current.startPointer.y,
    };

    dragStateRef.current.currentDelta = delta;

    const nextPositions = dragStateRef.current.cards.map((entry) => ({
      id: entry.card.id,
      position: {
        x: entry.startPosition.x + delta.x,
        y: entry.startPosition.y + delta.y,
      },
    }));

    if (nextPositions.length === 1) {
      onMoveCard(nextPositions[0].id, nextPositions[0].position);
      return;
    }

    onMoveCards(nextPositions);
  }, [onMoveCard, onMoveCards]);

  const finalizeDrag = useCallback(() => {
    if (!dragStateRef.current || !boardRef.current) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const { cards, currentDelta } = dragStateRef.current;
    const finalCards = cards.map((entry) => {
      const position = {
        x: entry.startPosition.x + currentDelta.x,
        y: entry.startPosition.y + currentDelta.y,
      };

      return { ...entry, position };
    });

    if (finalCards.length > 1) {
      const shouldReturnAll = finalCards.some((entry) =>
        isCardOutsideBoard(entry.position, entry.width, entry.height, boardRect),
      );

      if (shouldReturnAll) {
        onReturnCardsToLibrary(finalCards.map((entry) => entry.card));
      } else {
        onMoveCards(
          finalCards.map((entry) => ({
            id: entry.card.id,
            position: entry.position,
          })),
        );
      }
    } else {
      const [entry] = finalCards;

      if (isCardOutsideBoard(entry.position, cardWidth, cardHeight, boardRect)) {
        onReturnToLibrary(card);
      } else {
        onMoveCard(card.id, entry.position);
      }
    }

    dragStateRef.current = null;
  }, [
    boardRef,
    card,
    cardHeight,
    cardWidth,
    onMoveCard,
    onMoveCards,
    onReturnCardsToLibrary,
    onReturnToLibrary,
  ]);

  const startDrag = useCallback((clientX, clientY) => {
    const dragCards = isSelected && selectedCards.length > 1 ? selectedCards : [card];

    if (!isSelected && selectedCards.length) {
      onClearSelection();
    }

    dragStateRef.current = {
      startPointer: { x: clientX, y: clientY },
      currentDelta: { x: 0, y: 0 },
      cards: dragCards.map((dragCard) => ({
        card: dragCard,
        startPosition: dragCard.position,
        ...getCardDimensions(dragCard),
      })),
    };

    setIsDragging(true);
  }, [card, isSelected, onClearSelection, selectedCards]);

  const handleMouseDown = useCallback((event) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey) {
      onToggleSelection(card.id);
      return;
    }

    startDrag(event.clientX, event.clientY);
  }, [card.id, onToggleSelection, startDrag]);

  const handleMouseMove = useCallback((event) => {
    if (!dragStateRef.current) return;

    updateDraggedCards(event.clientX, event.clientY);
  }, [updateDraggedCards]);

  const handleMouseUp = useCallback(() => {
    if (!dragStateRef.current) return;

    setIsDragging(false);
    finalizeDrag();
  }, [finalizeDrag]);

  const handleTouchStart = useCallback((event) => {
    const touch = event.touches[0];

    event.stopPropagation();
    hasMovedBeforeDrag.current = false;

    if (isIOS && isSafari) {
      longPressTimer.current = setTimeout(() => {
        if (!hasMovedBeforeDrag.current) {
          startDrag(touch.clientX, touch.clientY);
        }
      }, 400);
    } else {
      startDrag(touch.clientX, touch.clientY);
    }
  }, [isIOS, isSafari, startDrag]);

  const handleTouchMove = useCallback((event) => {
    const touch = event.touches[0];

    if (!dragStateRef.current && longPressTimer.current) {
      hasMovedBeforeDrag.current = true;
      clearTimeout(longPressTimer.current);
      return;
    }

    if (!dragStateRef.current) return;

    updateDraggedCards(touch.clientX, touch.clientY);
  }, [updateDraggedCards]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);

    if (!dragStateRef.current) return;

    setIsDragging(false);
    finalizeDrag();
  }, [finalizeDrag]);

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

  useEffect(() => {
    if (!dragStateRef.current) return;

    const stillDraggingCard = dragStateRef.current.cards.some(
      (entry) => entry.card.id === card.id,
    );

    if (!stillDraggingCard) {
      dragStateRef.current = null;
      setIsDragging(false);
    }
  }, [card.id, card.position]);

  return {
    isDragging,
    handleMouseDown,
    handleTouchStart,
  };
}
