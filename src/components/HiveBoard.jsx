import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrop } from "react-dnd";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateLeft, faRotateRight } from "@fortawesome/free-solid-svg-icons";
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
  onToggleCardSelection,
  onClearSelection,
  onOpenCardNote,
  noteLocked = false,
  canEdit = true,
  isCompactLayout = false,
  isLibraryOpen = false,
  onToggleLibrary,
  onZoomChange,
  resetSignal = 0,
}) {
  const { t } = useLanguage();
  const boardRef = useRef(null);
  const viewportRef = useRef(null);
  const panStateRef = useRef(null);
  const zoomRef = useRef(BOARD_DEFAULT_ZOOM);
  const wheelZoomTargetRef = useRef(BOARD_DEFAULT_ZOOM);
  const wheelZoomAnchorRef = useRef(null);
  const wheelZoomFrameRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(
    isCompactLayout ? BOARD_COMPACT_DEFAULT_ZOOM : BOARD_DEFAULT_ZOOM,
  );
  const [activeResetSignal, setActiveResetSignal] = useState(resetSignal);
  const [isPanning, setIsPanning] = useState(false);
  const selectedCards = cards.filter((card) => selectedCardIds.has(card.id));
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

  useEffect(
    () => () => {
      if (wheelZoomFrameRef.current) {
        cancelAnimationFrame(wheelZoomFrameRef.current);
      }
    },
    [],
  );
  const scaledBoardWidth = BOARD_CANVAS_WIDTH * zoom;
  const scaledBoardHeight = BOARD_CANVAS_HEIGHT * zoom;
  const shellWidth = Math.max(viewportSize.width, scaledBoardWidth);
  const shellHeight = Math.max(viewportSize.height, scaledBoardHeight);
  const canvasContentStyle = useMemo(() => {
    const style = {
      width: `${BOARD_CANVAS_WIDTH}px`,
      height: `${BOARD_CANVAS_HEIGHT}px`,
    };

    if (supportsCssZoom) {
      style.zoom = zoom;
      return style;
    }

    style.transform = `scale(${zoom})`;
    return style;
  }, [supportsCssZoom, zoom]);

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

        const offset =
          monitor.getClientOffset() || monitor.getSourceClientOffset();
        if (!boardRef.current) return;

        const boardRect = boardRef.current.getBoundingClientRect();

        if (
          offset &&
          (offset.x < boardRect.left ||
            offset.x > boardRect.right ||
            offset.y < boardRect.top ||
            offset.y > boardRect.bottom)
        ) {
          return;
        }

        const fallbackOffset = {
          x: boardRect.left + boardRect.width / 2,
          y: boardRect.top + boardRect.height / 2,
        };
        const effectiveOffset = offset || fallbackOffset;

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
    if (event.target === event.currentTarget) {
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
      if (event.target !== event.currentTarget) return;

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      onClearSelection();
      startPan(event.clientX, event.clientY);
    },
    [onClearSelection, startPan],
  );

  useEffect(() => {
    if (!isPanning) return undefined;

    const handlePointerMove = (event) => {
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
  }, [isPanning]);

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

  return (
    <main className="hive-board">
      <header className="hive-board__controls">
        <div className="hive-board__controls-group">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canEdit || !canUndo}
          >
            <FontAwesomeIcon icon={faRotateLeft} /> {t("workspace.undo")}
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canEdit || !canRedo}
          >
            <FontAwesomeIcon icon={faRotateRight} /> {t("workspace.redo")}
          </button>
          {isCompactLayout ? (
            <button type="button" onClick={onToggleLibrary}>
              {isLibraryOpen
                ? t("workspace.hideLibrary")
                : t("workspace.showLibrary")}
            </button>
          ) : null}
        </div>
        <div className="hive-board__controls-group hive-board__controls-group--zoom">
          <button
            type="button"
            onClick={() => updateZoom(zoom - BOARD_ZOOM_STEP)}
          >
            {t("workspace.zoomOut")}
          </button>
          <button
            type="button"
            className="hive-board__zoom-value"
            aria-label={t("workspace.resetZoom")}
            title={t("workspace.resetZoom")}
            onClick={() => updateZoom(defaultZoom)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => updateZoom(zoom + BOARD_ZOOM_STEP)}
          >
            {t("workspace.zoomIn")}
          </button>
          <button type="button" onClick={handleFitContent}>
            {t("workspace.fitContent")}
          </button>
          <button type="button" onClick={handleFitBoard}>
            {t("workspace.fitBoard")}
          </button>
        </div>
      </header>
      <div
        ref={handleViewportRef}
        className={`hive-board__viewport ${isPanning ? "is-panning" : ""} ${isDefaultZoom ? "is-default-zoom" : ""}`.trim()}
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
    </main>
  );
}
