import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LibraryCard from "./LibraryCard";
import FreeHexCard from "./FreeSpaceCard";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { useLanguage } from "../context/LanguageContext";

export default function CardLibrary({
  cards,
  onFreeSpaceClick,
  userCards,
  canEdit = true,
  isTabletEditorMode = false,
  selectedCount = 0,
  onClearSelected,
  onGoToBoard,
  onToggleLibraryCardSelection,
  selectedLibraryCardIds,
  isFreeCardSelected = false,
  onToggleFreeCardSelection,
}) {
  const { cardCategories, t } = useLanguage();
  const categories = cardCategories;

  const [warningMessage, setWarningMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const warningTimeoutRef = useRef(null);

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

  const showWarning = useCallback((message) => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    setWarningMessage(message);
    warningTimeoutRef.current = setTimeout(() => {
      setWarningMessage("");
      warningTimeoutRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (!warningTimeoutRef.current) return;
      clearTimeout(warningTimeoutRef.current);
    };
  }, []);

  const handleUnavailableEdit = useCallback(() => {
    showWarning(t("cardLibrary.editNotAllowed"));
  }, [showWarning, t]);

  const handleFreeSpaceClick = useCallback(() => {
    if (!canEdit) {
      handleUnavailableEdit();
      return;
    }

    if (userCards >= 10) {
      showWarning(t("cardLibrary.maxFreeCardsReached"));
      return;
    }

    if (isTabletEditorMode) {
      onToggleFreeCardSelection?.();
      return;
    }

    onFreeSpaceClick();
  }, [
    canEdit,
    handleUnavailableEdit,
    isTabletEditorMode,
    onFreeSpaceClick,
    onToggleFreeCardSelection,
    showWarning,
    t,
    userCards,
  ]);

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

      {isTabletEditorMode && canEdit ? (
        <div className="card-library__select-toolbar">
          <p className="card-library__select-help">
            {selectedCount > 0
              ? t("cardLibrary.selectedCount", { count: selectedCount })
              : t("cardLibrary.tapToSelectHelp")}
          </p>
          <button
            type="button"
            className={selectedCount > 0 ? "is-active" : ""}
            onClick={onClearSelected}
            disabled={selectedCount === 0}
          >
            {t("cardLibrary.clearSelection")}
          </button>
          <button
            type="button"
            className={selectedCount > 0 ? "is-active" : ""}
            onClick={onGoToBoard}
            disabled={selectedCount === 0}
          >
            {t("cardLibrary.goToBoard", { count: selectedCount })}
          </button>
        </div>
      ) : null}

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
                  className={`library-card free-space ${isFreeCardSelected ? "library-card--selected" : ""}`.trim()}
                  onClick={handleFreeSpaceClick}
                  style={{ cursor: canEdit ? "pointer" : "not-allowed" }}
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
                  canEdit={canEdit}
                  isTabletSelectable={isTabletEditorMode}
                  isSelected={selectedLibraryCardIds?.has(card.id)}
                  onToggleSelect={onToggleLibraryCardSelection}
                  onUnavailableInteraction={handleUnavailableEdit}
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
      {warningMessage && (
        <div
          className="card-library__popup-warning"
          role="status"
          aria-live="polite"
        >
          <FontAwesomeIcon icon={faExclamationTriangle} /> {warningMessage}
        </div>
      )}
    </aside>
  );
}
