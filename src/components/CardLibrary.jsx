import { useCallback, useMemo, useState } from "react";
import LibraryCard from "./LibraryCard";
import FreeHexCard from "./FreeSpaceCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { useLanguage } from "../context/LanguageContext";

export default function CardLibrary({ cards, onFreeSpaceClick, userCards }) {
  const { cardCategories, t } = useLanguage();
  const categories = cardCategories;

  const [showPopup, setShowPopup] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredCards = useMemo(() => {
    if (!normalizedSearch) return cards;

    return cards.filter((card) => {
      const haystack = [card.title, card.definition, String(card.id)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [cards, normalizedSearch]);

  const freeCardMatchesSearch = useMemo(() => {
    if (!normalizedSearch) return true;

    const freeHaystack = [t("cardLibrary.freeCardTitle"), "free"]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return freeHaystack.includes(normalizedSearch);
  }, [normalizedSearch, t]);

  const hasAnySearchResult = filteredCards.length > 0 || freeCardMatchesSearch;

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
      <div className="card-library__search">
        <div className="card-library__search-input">
          <input
            id="card-library-search"
            name="card-library-search"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t("cardLibrary.searchPlaceholder")}
            aria-label={t("cardLibrary.searchLabel")}
          />
          {normalizedSearch ? (
            <button
              type="button"
              className="card-library__clear-search"
              onClick={() => setSearchTerm("")}
              aria-label={t("cardLibrary.clearSearch")}
              title={t("cardLibrary.clearSearch")}
            >
              x
            </button>
          ) : null}
        </div>
      </div>

      {categories.map(({ label, key }) => {
        const cardsInCategory = filteredCards.filter(
          (card) => card.category === key,
        );

        if (key === "free") {
          if (normalizedSearch && !freeCardMatchesSearch) {
            return null;
          }

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
                <LibraryCard
                  key={card.id}
                  card={card}
                  searchTerm={normalizedSearch}
                  isSearchActive={Boolean(normalizedSearch)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {normalizedSearch && !hasAnySearchResult ? (
        <p className="card-library__empty-search">
          {t("cardLibrary.noResults")}
        </p>
      ) : null}

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
