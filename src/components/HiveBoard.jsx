import { useRef } from "react";
import { useDrop } from "react-dnd";
import DraggableCard from "./DraggableCard";
import DraggableFreeCard from "./DraggableFreeCard";

export default function HiveBoard({ cards, onDropCard, onReturnToLibrary }) {
  const boardRef = useRef(null);

  const handleMoveCard = (id, position) => {
    onDropCard(
      cards.find((c) => c.id === id),
      position,
      false
    );
  };

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

      const position = {
        x: offset.x - boardRect.left - 70,
        y: offset.y - boardRect.top - 70,
      };

      onDropCard(item.card, position, true);
    },
  }));

  return (
    <main
      ref={(node) => {
        boardRef.current = node;
        drop(node);
      }}
      className="hive-board"
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      {cards.map((card) => {
        if (card.category === "free") {
          return (
            <DraggableFreeCard
              key={card.id}
              card={card}
              boardRef={boardRef}
              onMoveCard={handleMoveCard}
              onReturnToLibrary={onReturnToLibrary}
            />
          );
        }
        return (
          <DraggableCard
            key={card.id}
            card={card}
            boardRef={boardRef}
            onMoveCard={handleMoveCard}
            onReturnToLibrary={onReturnToLibrary}
          />
        );
      })}
    </main>
  );
}
