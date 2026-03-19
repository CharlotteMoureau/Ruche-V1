import { useState, useCallback } from "react";
import LibraryCard from "./LibraryCard";
import FreeHexCard from "./FreeSpaceCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

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

  const handleFreeSpaceClick = useCallback(() => {
    if (userCards >= 10) {
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 5000);
      return;
    }
    onFreeSpaceClick();
  }, [userCards, onFreeSpaceClick]);

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
                <LibraryCard key={card.id} card={card} />
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
