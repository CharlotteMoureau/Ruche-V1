import HexCard from "./HexCard";
import FreeHexCard from "./FreeSpaceCard";
import DraggableBoardCard from "./DraggableBoardCard";

export default function DraggableCard({
  card,
  isSelected,
  selectedCards,
  zoom,
  onMoveCard,
  onMoveCards,
  onReturnToLibrary,
  onReturnCardsToLibrary,
  onToggleSelection,
  onClearSelection,
}) {
  const isFreeCard = card.category === "free";

  return (
    <DraggableBoardCard
      card={card}
      className={isFreeCard ? "free-space" : ""}
      isSelected={isSelected}
      selectedCards={selectedCards}
      zoom={zoom}
      onMoveCard={onMoveCard}
      onMoveCards={onMoveCards}
      onReturnToLibrary={onReturnToLibrary}
      onReturnCardsToLibrary={onReturnCardsToLibrary}
      onToggleSelection={onToggleSelection}
      onClearSelection={onClearSelection}
    >
      {isFreeCard ? <FreeHexCard card={card} /> : <HexCard card={card} />}
    </DraggableBoardCard>
  );
}
