import { useState, useCallback } from "react";
import LibraryCard from "./LibraryCard";
import FreeHexCard from "./FreeSpaceCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { useLanguage } from "../context/LanguageContext";

export default function CardLibrary({ cards, onFreeSpaceClick, userCards }) {
  const { cardCategories, t } = useLanguage();
  const categories = cardCategories;

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
      <h2>{t("cardLibrary.title")}</h2>

      {categories.map(({ label, key }) => {
        const cardsInCategory = cards.filter((card) => card.category === key);

        if (key === "free") {
          return (
            <div key={key} className="card-category">
              <h3>
                {label}{" "}
                <span className="counter">
                  ({10 - userCards} {t("cardLibrary.remaining")})
                </span>
              </h3>
              <div className="card-list">
                <div
                  className="library-card free-space"
                  onClick={handleFreeSpaceClick}
                >
                  <FreeHexCard
                    card={{
                      title: t("cardLibrary.freeCardTitle"),
                      category: "free",
                    }}
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
          <FontAwesomeIcon icon={faExclamationTriangle} />{" "}
          {t("cardLibrary.maxFreeCardsReached")}
        </div>
      )}
    </aside>
  );
}
