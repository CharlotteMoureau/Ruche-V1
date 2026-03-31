import { useState, useRef, useEffect, useCallback } from "react";
import {
  BOARD_CARD_SIZE,
  BOARD_CANVAS_HEIGHT,
  BOARD_CANVAS_WIDTH,
  clampBoardPosition,
} from "../lib/board";

function getCardDimensions() {
  return { width: BOARD_CARD_SIZE, height: BOARD_CARD_SIZE };
}

export function useDraggableCard({
  card,
  cardWidth,
  cardHeight,
  boardWidth = BOARD_CANVAS_WIDTH,
  boardHeight = BOARD_CANVAS_HEIGHT,
  zoom = 1,
  isSelected,
  selectedCards,
  onMoveCard,
  onMoveCards,
  onReturnToLibrary,
  onReturnCardsToLibrary,
  onDragStart,
  onToggleSelection,
  onClearSelection,
  selectionMode = false,
  dragDisabled = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef(null);
  const ignoreMouseUntilRef = useRef(0);

  const updateDraggedCards = useCallback((clientX, clientY) => {
    if (!dragStateRef.current) return;

    const delta = {
      x: (clientX - dragStateRef.current.startPointer.x) / zoom,
      y: (clientY - dragStateRef.current.startPointer.y) / zoom,
    };

    dragStateRef.current.currentDelta = delta;

    if (
      !dragStateRef.current.historyCaptured &&
      (Math.abs(delta.x) > 0 || Math.abs(delta.y) > 0)
    ) {
      dragStateRef.current.historyCaptured = true;
      onDragStart?.();
    }

    const nextPositions = dragStateRef.current.cards.map((entry) => ({
      id: entry.card.id,
      position: {
        x: entry.startPosition.x + delta.x,
        y: entry.startPosition.y + delta.y,
      },
    }));

    if (nextPositions.length === 1) {
      onMoveCard(
        nextPositions[0].id,
        clampBoardPosition(nextPositions[0].position),
      );
      return;
    }

    onMoveCards(
      nextPositions.map((entry) => ({
        ...entry,
        position: clampBoardPosition(entry.position),
      })),
    );
  }, [onDragStart, onMoveCard, onMoveCards, zoom]);

  const finalizeDrag = useCallback(() => {
    if (!dragStateRef.current) return;

    const { cards, currentDelta } = dragStateRef.current;
    const finalCards = cards.map((entry) => {
      const position = {
        x: entry.startPosition.x + currentDelta.x,
        y: entry.startPosition.y + currentDelta.y,
      };

      return { ...entry, position };
    });

    if (finalCards.length > 1) {
      onMoveCards(
        finalCards.map((entry) => ({
          id: entry.card.id,
          position: clampBoardPosition(entry.position),
        })),
      );
    } else {
      const [entry] = finalCards;

      onMoveCard(card.id, clampBoardPosition(entry.position));
    }

    dragStateRef.current = null;
  }, [
    boardHeight,
    boardWidth,
    card,
    cardHeight,
    cardWidth,
    onMoveCard,
    onMoveCards,
  ]);

  const startDrag = useCallback((clientX, clientY) => {
    const dragCards = isSelected && selectedCards.length > 1 ? selectedCards : [card];

    if (!isSelected && selectedCards.length) {
      onClearSelection();
    }

    dragStateRef.current = {
      startPointer: { x: clientX, y: clientY },
      currentDelta: { x: 0, y: 0 },
      historyCaptured: false,
      cards: dragCards.map((dragCard) => ({
        card: dragCard,
        startPosition: dragCard.position,
        ...getCardDimensions(dragCard),
      })),
    };

    setIsDragging(true);
  }, [card, isSelected, onClearSelection, selectedCards]);

  const handleMouseDown = useCallback((event) => {
    if (dragDisabled) return;
    if (event.button !== 0) return;
    if (Date.now() < ignoreMouseUntilRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    if (selectionMode) {
      if (isSelected) {
        startDrag(event.clientX, event.clientY);
      } else {
        onToggleSelection(card.id);
      }
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      onToggleSelection(card.id);
      return;
    }

    startDrag(event.clientX, event.clientY);
  }, [
    card.id,
    dragDisabled,
    isSelected,
    onToggleSelection,
    selectionMode,
    startDrag,
  ]);

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
    if (dragDisabled) return;
    const touch = event.touches[0];

    event.preventDefault();
    event.stopPropagation();
    ignoreMouseUntilRef.current = Date.now() + 700;

    if (selectionMode) {
      if (isSelected) {
        startDrag(touch.clientX, touch.clientY);
      } else {
        onToggleSelection(card.id);
      }
      return;
    }

    startDrag(touch.clientX, touch.clientY);
  }, [
    card.id,
    dragDisabled,
    isSelected,
    onToggleSelection,
    selectionMode,
    startDrag,
  ]);

  const handleTouchMove = useCallback((event) => {
    if (event.touches.length < 1) return;
    const touch = event.touches[0];

    if (!dragStateRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    updateDraggedCards(touch.clientX, touch.clientY);
  }, [updateDraggedCards]);

  const handleTouchEnd = useCallback((event) => {
    event.stopPropagation();
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
