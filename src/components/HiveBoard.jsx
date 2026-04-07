import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrop } from "react-dnd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faRotateLeft,
  faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import DraggableCard from "./DraggableCard";
import { useLanguage } from "../context/LanguageContext";
import {
  BOARD_CANVAS_HEIGHT,
  BOARD_CANVAS_WIDTH,
  BOARD_CARD_SIZE,
  BOARD_COMPACT_DEFAULT_ZOOM,
  BOARD_DEFAULT_ZOOM,
  BOARD_NOTE_OFFSET,
  BOARD_ZOOM_STEP,
  clampBoardPosition,
  clampBoardZoom,
} from "../lib/board";

export default function HiveBoard({
  cards,
  onDropCard,
  onMoveCard,
  onMoveCards,
  onReturnToLibrary,
  onReturnCardsToLibrary,
  onCardDragStart,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  selectedCardIds,
  boardSelectionMode = false,
  onToggleCardSelection,
  onClearSelection,
  onToggleBoardSelectionMode,
  onExitBoardSelectionMode,
  onReturnSelectedCards,
  onOpenCardNote,
  noteLocked = false,
  canEdit = true,
  isTabletEditorMode = false,
  isCompactLayout = false,
  isLibraryOpen = false,
  onToggleLibrary,
  onZoomChange,
  resetSignal = 0,
  pendingLibraryCards = [],
  onPlaceLibraryCards,
  autoPlaceSignal = 0,
  tabletUsageBlocked = false,
  isCardDragging = false,
}) {
  const { t } = useLanguage();
  const boardRef = useRef(null);
  const viewportRef = useRef(null);
  const panStateRef = useRef(null);
  const dragScrollLockRef = useRef(null);
  const pinchStateRef = useRef(null);
  const zoomRef = useRef(BOARD_DEFAULT_ZOOM);
  const wheelZoomTargetRef = useRef(BOARD_DEFAULT_ZOOM);
  const wheelZoomAnchorRef = useRef(null);
  const wheelZoomFrameRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(
    isCompactLayout ? BOARD_COMPACT_DEFAULT_ZOOM : BOARD_DEFAULT_ZOOM,
  );
  const [activeResetSignal, setActiveResetSignal] = useState(resetSignal);
  const [activeAutoPlaceSignal, setActiveAutoPlaceSignal] =
    useState(autoPlaceSignal);
  const [isPanning, setIsPanning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const selectedCards = cards.filter((card) => selectedCardIds.has(card.id));
  const selectedCount = selectedCardIds.size;
  const defaultZoom = isCompactLayout
    ? BOARD_COMPACT_DEFAULT_ZOOM
    : BOARD_DEFAULT_ZOOM;
  const isDefaultZoom = Math.abs(zoom - defaultZoom) < 0.001;
  const supportsCssZoom = useMemo(() => {
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
      return false;
    }

    return CSS.supports("zoom", "1");
  }, []);
  const useCssZoom = supportsCssZoom && !isTabletEditorMode;

  useEffect(() => {
    onZoomChange?.(zoom);
  }, [zoom, onZoomChange]);

  useEffect(() => {
    zoomRef.current = zoom;
    if (!wheelZoomFrameRef.current) {
      wheelZoomTargetRef.current = zoom;
    }
  }, [zoom]);

  useEffect(() => {
    if (resetSignal === activeResetSignal) return;

    if (wheelZoomFrameRef.current) {
      cancelAnimationFrame(wheelZoomFrameRef.current);
      wheelZoomFrameRef.current = null;
    }

    wheelZoomTargetRef.current = defaultZoom;
    wheelZoomAnchorRef.current = null;
    zoomRef.current = defaultZoom;
    setZoom(defaultZoom);
    requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    });

    setActiveResetSignal(resetSignal);
  }, [activeResetSignal, defaultZoom, resetSignal]);

  useEffect(() => {
    if (autoPlaceSignal === activeAutoPlaceSignal) return;

    if (!pendingLibraryCards.length || tabletUsageBlocked) {
      setActiveAutoPlaceSignal(autoPlaceSignal);
      return;
    }

    requestAnimationFrame(() => {
      const board = boardRef.current;
      const viewport = viewportRef.current;
      if (!board || !viewport) return;

      const boardRect = board.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const centerX = viewportRect.left + viewportRect.width / 2;
      const centerY = viewportRect.top + viewportRect.height / 2;

      onPlaceLibraryCards?.({
        anchor: clampBoardPosition({
          x: (centerX - boardRect.left) / zoom - BOARD_CARD_SIZE / 2,
          y: (centerY - boardRect.top) / zoom - BOARD_CARD_SIZE / 2,
        }),
        cards: pendingLibraryCards,
      });
    });

    setActiveAutoPlaceSignal(autoPlaceSignal);
  }, [
    activeAutoPlaceSignal,
    autoPlaceSignal,
    onPlaceLibraryCards,
    pendingLibraryCards,
    tabletUsageBlocked,
    zoom,
  ]);

  useEffect(
    () => () => {
      if (wheelZoomFrameRef.current) {
        cancelAnimationFrame(wheelZoomFrameRef.current);
      }

      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    },
    [],
  );

  const showWarning = useCallback((message) => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    setWarningMessage(message);
    warningTimeoutRef.current = setTimeout(() => {
      setWarningMessage("");
      warningTimeoutRef.current = null;
    }, 5000);
  }, []);

  const handleUnavailableEdit = useCallback(() => {
    if (tabletUsageBlocked) return;
    showWarning(t("workspace.editNotAllowed"));
  }, [showWarning, t, tabletUsageBlocked]);
  const scaledBoardWidth = BOARD_CANVAS_WIDTH * zoom;
  const scaledBoardHeight = BOARD_CANVAS_HEIGHT * zoom;
  const shellWidth = Math.max(viewportSize.width, scaledBoardWidth);
  const shellHeight = Math.max(viewportSize.height, scaledBoardHeight);
  const canvasContentStyle = useMemo(() => {
    const style = {
      width: `${BOARD_CANVAS_WIDTH}px`,
      height: `${BOARD_CANVAS_HEIGHT}px`,
    };

    if (useCssZoom) {
      style.zoom = zoom;
      return style;
    }

    style.transform = `scale(${zoom})`;
    return style;
  }, [useCssZoom, zoom]);

  const contentBounds = useMemo(() => {
    if (!cards.length) return null;

    const positions = cards.map((card) => ({
      left: card.position.x,
      top: card.position.y,
      right: card.position.x + BOARD_CARD_SIZE,
      bottom: card.position.y + BOARD_CARD_SIZE,
    }));

    return {
      left: Math.min(...positions.map((entry) => entry.left)),
      top: Math.min(...positions.map((entry) => entry.top)),
      right: Math.max(...positions.map((entry) => entry.right)),
      bottom: Math.max(...positions.map((entry) => entry.bottom)),
    };
  }, [cards]);

  const setViewportCenter = useCallback((boardX, boardY, targetZoom) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxScrollLeft = Math.max(
      0,
      viewport.scrollWidth - viewport.clientWidth,
    );
    const maxScrollTop = Math.max(
      0,
      viewport.scrollHeight - viewport.clientHeight,
    );

    viewport.scrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, boardX * targetZoom - viewport.clientWidth / 2),
    );
    viewport.scrollTop = Math.min(
      maxScrollTop,
      Math.max(0, boardY * targetZoom - viewport.clientHeight / 2),
    );
  }, []);

  const getBoardPointFromClient = useCallback(
    (clientX, clientY) => {
      const board = boardRef.current;
      if (!board) return null;

      const boardRect = board.getBoundingClientRect();

      return {
        x: (clientX - boardRect.left) / zoom,
        y: (clientY - boardRect.top) / zoom,
      };
    },
    [zoom],
  );

  const updateZoom = useCallback(
    (nextZoom, anchorPoint) => {
      const clampedZoom = clampBoardZoom(nextZoom);
      const viewport = viewportRef.current;

      if (wheelZoomFrameRef.current) {
        cancelAnimationFrame(wheelZoomFrameRef.current);
        wheelZoomFrameRef.current = null;
      }

      wheelZoomTargetRef.current = clampedZoom;
      wheelZoomAnchorRef.current = null;
      zoomRef.current = clampedZoom;

      if (!viewport || clampedZoom === zoom) {
        setZoom(clampedZoom);
        return;
      }

      const targetPoint = anchorPoint || {
        x: (viewport.scrollLeft + viewport.clientWidth / 2) / zoom,
        y: (viewport.scrollTop + viewport.clientHeight / 2) / zoom,
      };

      setZoom(clampedZoom);

      requestAnimationFrame(() => {
        setViewportCenter(targetPoint.x, targetPoint.y, clampedZoom);
      });
    },
    [setViewportCenter, zoom],
  );

  const centerViewportOnArea = useCallback(
    (area, targetZoom) => {
      setViewportCenter(
        (area.left + area.right) / 2,
        (area.top + area.bottom) / 2,
        targetZoom,
      );
    },
    [setViewportCenter],
  );

  const handleFitBoard = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const fitZoom = Math.min(
      viewport.clientWidth / BOARD_CANVAS_WIDTH,
      viewport.clientHeight / BOARD_CANVAS_HEIGHT,
    );

    updateZoom(fitZoom);

    requestAnimationFrame(() => {
      const nextViewport = viewportRef.current;
      if (!nextViewport) return;

      nextViewport.scrollLeft = 0;
      nextViewport.scrollTop = 0;
    });
  }, [updateZoom]);

  const handleFitContent = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (!contentBounds) {
      handleFitBoard();
      return;
    }

    const padding = BOARD_CARD_SIZE * 0.35;
    const area = {
      left: Math.max(0, contentBounds.left - padding),
      top: Math.max(0, contentBounds.top - padding),
      right: Math.min(BOARD_CANVAS_WIDTH, contentBounds.right + padding),
      bottom: Math.min(BOARD_CANVAS_HEIGHT, contentBounds.bottom + padding),
    };

    const fitZoom = Math.min(
      viewport.clientWidth / Math.max(1, area.right - area.left),
      viewport.clientHeight / Math.max(1, area.bottom - area.top),
    );
    const clampedZoom = clampBoardZoom(fitZoom);

    setZoom(clampedZoom);

    requestAnimationFrame(() => {
      centerViewportOnArea(area, clampedZoom);
    });
  }, [centerViewportOnArea, contentBounds, handleFitBoard]);

  const [, drop] = useDrop(
    () => ({
      accept: "CARD",
      drop: (item, monitor) => {
        if (!item?.card) return;

        const offset = monitor.getClientOffset();
        if (!boardRef.current) return;

        const boardRect = boardRef.current.getBoundingClientRect();
        const viewport = viewportRef.current;
        const viewportRect = viewport?.getBoundingClientRect();
        const isInsideBoard =
          Boolean(offset) &&
          offset.x >= boardRect.left &&
          offset.x <= boardRect.right &&
          offset.y >= boardRect.top &&
          offset.y <= boardRect.bottom;
        const isInsideViewport =
          Boolean(offset) &&
          Boolean(viewportRect) &&
          offset.x >= viewportRect.left &&
          offset.x <= viewportRect.right &&
          offset.y >= viewportRect.top &&
          offset.y <= viewportRect.bottom;

        const fallbackOffset = viewportRect
          ? {
            x: viewportRect.left + viewportRect.width / 2,
            y: viewportRect.top + viewportRect.height / 2,
          }
          : {
            x: boardRect.left + boardRect.width / 2,
            y: boardRect.top + boardRect.height / 2,
          };
        const effectiveOffset =
          isInsideBoard && isInsideViewport ? offset : fallbackOffset;

        const position = clampBoardPosition({
          x: (effectiveOffset.x - boardRect.left) / zoom - BOARD_CARD_SIZE / 2,
          y: (effectiveOffset.y - boardRect.top) / zoom - BOARD_CARD_SIZE / 2,
        });

        onDropCard(item.card, position, true);
      },
    }),
    [onDropCard, zoom],
  );

  const handleBoardMouseDown = (event) => {
    if (tabletUsageBlocked) return;
    if (event.target === event.currentTarget) {
      if (boardSelectionMode) {
        onExitBoardSelectionMode?.();
        return;
      }
      onClearSelection();
    }
  };

  const startPan = useCallback((clientX, clientY) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    panStateRef.current = {
      startX: clientX,
      startY: clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanning(true);
  }, []);

  const handleCanvasPointerDown = useCallback(
    (event) => {
      if (isCardDragging) return;
      if (event.target !== event.currentTarget) return;

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      if (tabletUsageBlocked) return;

      if (pendingLibraryCards.length > 0) {
        const boardPoint = getBoardPointFromClient(
          event.clientX,
          event.clientY,
        );
        if (!boardPoint) return;

        onPlaceLibraryCards?.({
          anchor: clampBoardPosition({
            x: boardPoint.x - BOARD_CARD_SIZE / 2,
            y: boardPoint.y - BOARD_CARD_SIZE / 2,
          }),
          cards: pendingLibraryCards,
        });
        return;
      }

      if (boardSelectionMode) {
        onExitBoardSelectionMode?.();
        return;
      }

      onClearSelection();
      startPan(event.clientX, event.clientY);
    },
    [
      getBoardPointFromClient,
      isCardDragging,
      onClearSelection,
      onExitBoardSelectionMode,
      onPlaceLibraryCards,
      pendingLibraryCards,
      boardSelectionMode,
      startPan,
      tabletUsageBlocked,
    ],
  );

  useEffect(() => {
    if (!isPanning) return undefined;

    const handlePointerMove = (event) => {
      if (isCardDragging) return;
      const viewport = viewportRef.current;
      const panState = panStateRef.current;
      if (!viewport || !panState) return;

      viewport.scrollLeft =
        panState.scrollLeft - (event.clientX - panState.startX);
      viewport.scrollTop =
        panState.scrollTop - (event.clientY - panState.startY);
    };

    const stopPanning = () => {
      panStateRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopPanning);
    window.addEventListener("pointercancel", stopPanning);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopPanning);
      window.removeEventListener("pointercancel", stopPanning);
    };
  }, [isCardDragging, isPanning]);

  useEffect(() => {
    if (!isCardDragging) return;
    panStateRef.current = null;
    setIsPanning(false);
  }, [isCardDragging]);

  useEffect(() => {
    if (!isCardDragging) {
      dragScrollLockRef.current = null;
      return undefined;
    }

    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    dragScrollLockRef.current = {
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };

    const lockScroll = () => {
      const lock = dragScrollLockRef.current;
      if (!lock) return;

      if (viewport.scrollLeft !== lock.left) {
        viewport.scrollLeft = lock.left;
      }

      if (viewport.scrollTop !== lock.top) {
        viewport.scrollTop = lock.top;
      }
    };

    viewport.addEventListener("scroll", lockScroll, { passive: true });

    return () => {
      viewport.removeEventListener("scroll", lockScroll);
    };
  }, [isCardDragging]);

  const handleNoteOpen = (event, card) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenCardNote?.(card);
  };

  const handleViewportWheel = useCallback(
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      event.stopPropagation();

      const anchorPoint = getBoardPointFromClient(event.clientX, event.clientY);
      if (!anchorPoint) return;

      const currentTarget = wheelZoomTargetRef.current || zoomRef.current;
      const nextTarget = clampBoardZoom(
        currentTarget * Math.exp(-event.deltaY * 0.0016),
      );

      wheelZoomTargetRef.current = nextTarget;
      wheelZoomAnchorRef.current = anchorPoint;

      if (wheelZoomFrameRef.current) return;

      const animateWheelZoom = () => {
        const targetZoom = wheelZoomTargetRef.current;
        const currentZoom = zoomRef.current;
        const delta = targetZoom - currentZoom;

        if (Math.abs(delta) < 0.001) {
          const finalZoom = clampBoardZoom(targetZoom);
          zoomRef.current = finalZoom;
          setZoom(finalZoom);

          const finalAnchor = wheelZoomAnchorRef.current;
          if (finalAnchor) {
            requestAnimationFrame(() => {
              setViewportCenter(finalAnchor.x, finalAnchor.y, finalZoom);
            });
          }

          wheelZoomFrameRef.current = null;
          return;
        }

        const easedZoom = clampBoardZoom(currentZoom + delta * 0.22);
        zoomRef.current = easedZoom;
        setZoom(easedZoom);

        const activeAnchor = wheelZoomAnchorRef.current;
        if (activeAnchor) {
          requestAnimationFrame(() => {
            setViewportCenter(activeAnchor.x, activeAnchor.y, easedZoom);
          });
        }

        wheelZoomFrameRef.current = requestAnimationFrame(animateWheelZoom);
      };

      wheelZoomFrameRef.current = requestAnimationFrame(animateWheelZoom);
    },
    [getBoardPointFromClient, setViewportCenter],
  );

  const handleViewportRef = useCallback(
    (node) => {
      viewportRef.current = node;
      drop(node);
    },
    [drop],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const handleNativeWheel = (event) => {
      handleViewportWheel(event);
    };

    viewport.addEventListener("wheel", handleNativeWheel, {
      passive: false,
    });

    return () => {
      viewport.removeEventListener("wheel", handleNativeWheel);
    };
  }, [handleViewportWheel]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const getDistance = (touchA, touchB) => {
      const dx = touchA.clientX - touchB.clientX;
      const dy = touchA.clientY - touchB.clientY;
      return Math.hypot(dx, dy);
    };

    const getMidpoint = (touchA, touchB) => ({
      x: (touchA.clientX + touchB.clientX) / 2,
      y: (touchA.clientY + touchB.clientY) / 2,
    });

    const handleTouchStart = (event) => {
      if (tabletUsageBlocked) return;
      if (event.touches.length !== 2) return;

      const [touchA, touchB] = event.touches;
      const midpoint = getMidpoint(touchA, touchB);
      const anchor = getBoardPointFromClient(midpoint.x, midpoint.y);

      if (!anchor) return;

      pinchStateRef.current = {
        startDistance: getDistance(touchA, touchB),
        startZoom: zoomRef.current,
        anchor,
      };

      panStateRef.current = null;
      setIsPanning(false);
      event.preventDefault();
    };

    const handleTouchMove = (event) => {
      if (tabletUsageBlocked) return;
      if (event.touches.length !== 2 || !pinchStateRef.current) return;

      const [touchA, touchB] = event.touches;
      const distance = getDistance(touchA, touchB);
      const ratio = distance / Math.max(1, pinchStateRef.current.startDistance);

      updateZoom(
        pinchStateRef.current.startZoom * ratio,
        pinchStateRef.current.anchor,
      );
      event.preventDefault();
    };

    const handleTouchEnd = () => {
      if (!pinchStateRef.current) return;
      pinchStateRef.current = null;
    };

    viewport.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    viewport.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    viewport.addEventListener("touchend", handleTouchEnd);
    viewport.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("touchend", handleTouchEnd);
      viewport.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [getBoardPointFromClient, tabletUsageBlocked, updateZoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const updateViewportSize = () => {
      setViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
    };

    updateViewportSize();

    const resizeObserver = new ResizeObserver(() => {
      updateViewportSize();
    });

    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const historyControls = (
    <>
      <button
        type="button"
        onClick={onUndo}
        disabled={tabletUsageBlocked || !canEdit || !canUndo}
      >
        <FontAwesomeIcon icon={faRotateLeft} /> {t("workspace.undo")}
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={tabletUsageBlocked || !canEdit || !canRedo}
      >
        <FontAwesomeIcon icon={faRotateRight} /> {t("workspace.redo")}
      </button>
    </>
  );

  return (
    <main className="hive-board">
      <header className="hive-board__controls">
        <div className="hive-board__controls-group">
          {!isTabletEditorMode ? historyControls : null}
          {isCompactLayout ? (
            <button type="button" onClick={onToggleLibrary}>
              {isLibraryOpen
                ? t("workspace.hideLibrary")
                : t("workspace.showLibrary")}
            </button>
          ) : null}
          {isTabletEditorMode ? (
            <button
              type="button"
              className={boardSelectionMode ? "is-active" : ""}
              onClick={onToggleBoardSelectionMode}
              disabled={tabletUsageBlocked || !canEdit}
            >
              {boardSelectionMode
                ? t("workspace.disableMultiSelect")
                : t("workspace.enableMultiSelect")}
            </button>
          ) : null}
          {isTabletEditorMode && boardSelectionMode && selectedCount > 0 ? (
            <button
              type="button"
              onClick={onReturnSelectedCards}
              disabled={tabletUsageBlocked || !canEdit}
            >
              {t("workspace.returnSelectedToLibrary", { count: selectedCount })}
            </button>
          ) : null}
        </div>
        <div className="hive-board__controls-group hive-board__controls-group--zoom">
          <button
            type="button"
            onClick={() => updateZoom(zoom - BOARD_ZOOM_STEP)}
            disabled={tabletUsageBlocked}
          >
            {t("workspace.zoomOut")}
          </button>
          <button
            type="button"
            className="hive-board__zoom-value"
            aria-label={t("workspace.resetZoom")}
            title={t("workspace.resetZoom")}
            onClick={() => updateZoom(defaultZoom)}
            disabled={tabletUsageBlocked}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => updateZoom(zoom + BOARD_ZOOM_STEP)}
            disabled={tabletUsageBlocked}
          >
            {t("workspace.zoomIn")}
          </button>
          <button
            type="button"
            onClick={handleFitContent}
            disabled={tabletUsageBlocked}
          >
            {t("workspace.fitContent")}
          </button>
          <button
            type="button"
            onClick={handleFitBoard}
            disabled={tabletUsageBlocked}
          >
            {t("workspace.fitBoard")}
          </button>
        </div>
      </header>
      <div className="hive-board__viewport-area">
        {warningMessage ? (
          <div
            className="card-library__popup-warning hive-board__warning"
            role="status"
            aria-live="polite"
          >
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <span>{warningMessage}</span>
          </div>
        ) : null}
        {isTabletEditorMode ? (
          <div className="hive-board__history-tablet">{historyControls}</div>
        ) : null}
        <div
          ref={handleViewportRef}
          className={`hive-board__viewport ${isPanning ? "is-panning" : ""} ${isDefaultZoom ? "is-default-zoom" : ""}`}
        >
          <div
            className="hive-board__canvas-shell"
            style={{
              width: `${shellWidth}px`,
              height: `${shellHeight}px`,
            }}
          >
            <div
              ref={boardRef}
              className="hive-board__canvas"
              style={{
                width: `${scaledBoardWidth}px`,
                height: `${scaledBoardHeight}px`,
              }}
            >
              <div
                className="hive-board__canvas-content"
                style={canvasContentStyle}
                onMouseDown={handleBoardMouseDown}
                onPointerDown={handleCanvasPointerDown}
                onTouchStart={handleBoardMouseDown}
              >
                {cards.map((card) => {
                  return (
                    <DraggableCard
                      key={card.id}
                      card={card}
                      isSelected={selectedCardIds.has(card.id)}
                      selectedCards={selectedCards}
                      zoom={zoom}
                      onMoveCard={onMoveCard}
                      onMoveCards={onMoveCards}
                      onReturnToLibrary={onReturnToLibrary}
                      onReturnCardsToLibrary={onReturnCardsToLibrary}
                      onDragStart={onCardDragStart}
                      onToggleSelection={onToggleCardSelection}
                      onClearSelection={onClearSelection}
                      selectionMode={isTabletEditorMode && boardSelectionMode}
                      isTabletEditorMode={isTabletEditorMode}
                      dragDisabled={tabletUsageBlocked || !canEdit}
                      onUnavailableInteraction={handleUnavailableEdit}
                    />
                  );
                })}
                <div className="hive-board__note-layer">
                  {cards.map((card) => {
                    const hasNote = Boolean(card?.comment?.message?.trim());

                    return (
                      <button
                        key={`${card.id}-note-indicator`}
                        type="button"
                        className={`card-note-indicator ${hasNote ? "has-note" : ""} ${noteLocked ? "is-locked" : ""}`.trim()}
                        style={{
                          left: card.position.x + BOARD_NOTE_OFFSET.x,
                          top: card.position.y + BOARD_NOTE_OFFSET.y,
                        }}
                        aria-label={t("workspace.cardNoteTitle")}
                        aria-disabled={noteLocked}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onTouchStart={(event) => {
                          event.stopPropagation();
                        }}
                        onClick={(event) => handleNoteOpen(event, card)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path
                            d="M4 4h16v11H8l-4 4V4zm2 2v8.17L7.17 13H18V6H6z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
