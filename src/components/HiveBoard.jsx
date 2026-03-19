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
}) {
  const boardRef = useRef(null);
  const selectedCards = cards.filter((card) => selectedCardIds.has(card.id));

  const [, drop] = useDrop(() => ({
    accept: "CARD",
    drop: (item, monitor) => {
      if (!item.fromLibrary) return;

      const offset = monitor.getClientOffset();
      if (!offset) return;

      const boardRect = boardRef.current.getBoundingClientRect();

      if (
        offset.x < boardRect.left ||
        offset.x > boardRect.right ||
        offset.y < boardRect.top ||
        offset.y > boardRect.bottom
      )
        return;

      const isIOS = document.body.classList.contains("ios");

      const position = {
        x: offset.x - boardRect.left - (isIOS ? 92 : 102),
        y: offset.y - boardRect.top - (isIOS ? 93 : 103),
      };

      onDropCard(item.card, position, true);
    },
  }));

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
          />
        );
      })}
    </main>
  );
}
