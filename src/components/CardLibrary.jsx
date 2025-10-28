import { useEffect } from "react";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import HexCard from "./HexCard";

function DraggableCard({ card }) {
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: "CARD",
    item: { card, fromLibrary: true },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  return (
    <div
      ref={drag}
      className={`library-card ${isDragging ? "dragging" : ""}`}
      style={{
        opacity: isDragging ? 0.4 : 1,
        margin: "4px",
        cursor: isDragging ? "grabbing" : "grab",
      }}
    >
      <HexCard card={card} />
    </div>
  );
}

export default function CardLibrary({ cards }) {
  const categories = [
    { label: "Visées & effets pour les élèves", key: "visees" },
    {
      label: "Conditions pour l’enseignant/intervenant",
      key: "conditions-enseignant",
    },
    {
      label: "Recommandations pour l’enseignant/intervenant",
      key: "recommandations-enseignant",
    },
    { label: "Conditions pour l’équipe éducative", key: "conditions-equipe" },
    {
      label: "Recommandation pour l’équipe éducative",
      key: "recommandations-equipe",
    },
    { label: "Domaines d’expression culturelle et artistique", key: "domaine" },
    { label: "Free space", key: "free" },
  ];

  return (
    <aside className="card-library">
      <h2>Cartes disponibles</h2>
      {categories.map(({ label, key }) => {
        const cardsInCategory = cards.filter((card) => card.category === key);
        if (!cardsInCategory.length) return null;
        return (
          <div key={key} className="card-category">
            <h3>{label}</h3>
            <div className="card-list">
              {cardsInCategory.map((card) => (
                <DraggableCard key={card.id} card={card} />
              ))}
            </div>
          </div>
        );
      })}
    </aside>
  );
}
