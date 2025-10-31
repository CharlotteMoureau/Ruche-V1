import { useEffect, useState } from "react";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import HexCard from "./HexCard";
import FreeHexCard from "./FreeSpaceCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

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

export default function CardLibrary({ cards, onFreeSpaceClick, userCards }) {
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
    { label: "À vous de jouer !", key: "free" },
  ];

  const [showPopup, setShowPopup] = useState(false);

  const handleFreeSpaceClick = () => {
    if (userCards >= 10) {
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 5000);
      return;
    }
    onFreeSpaceClick();
  };

  return (
    <aside className="card-library">
      <h2>Cartes disponibles</h2>

      {categories.map(({ label, key }) => {
        const cardsInCategory = cards.filter((card) => card.category === key);

        if (key === "free") {
          return (
            <div key={key} className="card-category">
              <h3>
                {label}{" "}
                <span className="counter">({10 - userCards} restantes)</span>
              </h3>
              <div className="card-list">
                <div
                  className="library-card free-space"
                  onClick={handleFreeSpaceClick}
                >
                  <FreeHexCard
                    card={{ title: "À vous de jouer !", category: "free" }}
                  />
                </div>
              </div>
            </div>
          );
        }

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

      {/* Popup warning */}
      {showPopup && (
        <div className="popup-warning">
          <FontAwesomeIcon icon={faExclamationTriangle} /> Vous avez déjà
          atteint le maximum de 10 cartes libres !
        </div>
      )}
    </aside>
  );
}
