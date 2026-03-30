import { useRef } from "react";
import { useDrop } from "react-dnd";
import DraggableCard from "./DraggableCard";
import DraggableFreeCard from "./DraggableFreeCard";

export default function HiveBoard({
  cards,
  onDropCard,
  onMoveCard,
  onMoveCards,
  onReturnToLibrary,
  onReturnCardsToLibrary,
  selectedCardIds,
  onToggleCardSelection,
  onClearSelection,
  onOpenCardComment,
  commentLocked = false,
}) {
  const boardRef = useRef(null);
  const selectedCards = cards.filter((card) => selectedCardIds.has(card.id));

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

        const cardSize = 200;
        const maxX = Math.max(0, boardRect.width - cardSize);
        const maxY = Math.max(0, boardRect.height - cardSize);

        const isIOS = document.body.classList.contains("ios");

        const position = {
          x: Math.min(
            maxX,
            Math.max(
              0,
              effectiveOffset.x - boardRect.left - (isIOS ? 92 : 102),
            ),
          ),
          y: Math.min(
            maxY,
            Math.max(0, effectiveOffset.y - boardRect.top - (isIOS ? 93 : 103)),
          ),
        };

        onDropCard(item.card, position, true);
      },
    }),
    [onDropCard],
  );

  const handleBoardMouseDown = (event) => {
    if (event.target === event.currentTarget) {
      onClearSelection();
    }
  };

  return (
    <main
      ref={(node) => {
        boardRef.current = node;
        drop(node);
      }}
      className="hive-board"
      style={{ position: "relative", width: "100%", height: "100%" }}
      onMouseDown={handleBoardMouseDown}
      onTouchStart={handleBoardMouseDown}
    >
      {cards.map((card) => {
        if (card.category === "free") {
          return (
            <DraggableFreeCard
              key={card.id}
              card={card}
              boardRef={boardRef}
              isSelected={selectedCardIds.has(card.id)}
              selectedCards={selectedCards}
              onMoveCard={onMoveCard}
              onMoveCards={onMoveCards}
              onReturnToLibrary={onReturnToLibrary}
              onReturnCardsToLibrary={onReturnCardsToLibrary}
              onToggleSelection={onToggleCardSelection}
              onClearSelection={onClearSelection}
              onOpenComment={onOpenCardComment}
              commentLocked={commentLocked}
            />
          );
        }
        return (
          <DraggableCard
            key={card.id}
            card={card}
            boardRef={boardRef}
            isSelected={selectedCardIds.has(card.id)}
            selectedCards={selectedCards}
            onMoveCard={onMoveCard}
            onMoveCards={onMoveCards}
            onReturnToLibrary={onReturnToLibrary}
            onReturnCardsToLibrary={onReturnCardsToLibrary}
            onToggleSelection={onToggleCardSelection}
            onClearSelection={onClearSelection}
            onOpenComment={onOpenCardComment}
            commentLocked={commentLocked}
          />
        );
      })}
    </main>
  );
}
