import { useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import CardLibrary from "./CardLibrary";
import HiveBoard from "./HiveBoard";
import cardsFr from "../data/cards.json";
import cardsEn from "../data/cards_en.json";
import cardsNl from "../data/cards_nl.json";
import CustomDragPreview from "./CustomDragPreview";
import AddCardModal from "./ModalFree";
import { useDeviceDetection } from "../hooks/useDeviceDetection";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import UnifiedPromptModal from "./UnifiedPromptModal";

const COMPACT_EDITOR_MEDIA_QUERY = "(max-width: 1200px)";

const CATEGORY_KEY_MAP = {
  fr: {
    visees: "visees",
    "conditions-enseignant": "conditions-enseignant",
    "recommandations-enseignant": "recommandations-enseignant",
    "conditions-equipe": "conditions-equipe",
    "recommandations-equipe": "recommandations-equipe",
    domaine: "domaine",
  },
  en: {
    aims: "visees",
    "teacher-conditions": "conditions-enseignant",
    "teacher-recommendations": "recommandations-enseignant",
    "team-conditions": "conditions-equipe",
    "team-recommendations": "recommandations-equipe",
    domain: "domaine",
  },
  nl: {
    doelen: "visees",
    "voorwaarden-leerkracht": "conditions-enseignant",
    "aanbevelingen-leerkracht": "recommandations-enseignant",
    "voorwaarden-team": "conditions-equipe",
    "aanbevelingen-team": "recommandations-equipe",
    domein: "domaine",
  },
};

function formatDateTime(value, locale) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getUserLabel(actor, fallbackLabel) {
  return actor?.username || actor?.email || fallbackLabel;
}

function getCardComment(card) {
  if (!card || typeof card !== "object") return null;
  return card.comment && typeof card.comment === "object" ? card.comment : null;
}

function stripCardComment(card) {
  if (!card || typeof card !== "object") return card;

  const rest = { ...card };
  delete rest.comment;
  return rest;
}

function toCanonicalCards(cards, language) {
  const map = CATEGORY_KEY_MAP[language] || CATEGORY_KEY_MAP.fr;
  return cards.map((card) => ({
    ...card,
    category: map[card.category] || card.category,
  }));
}

function localizeBoardCards(boardCards, cardsData) {
  const cardsById = new Map(cardsData.map((card) => [String(card.id), card]));

  return boardCards.map((card) => {
    if (card.category === "free") return card;

    const localized = cardsById.get(String(card.id));
    if (!localized) return card;

    return {
      ...card,
      title: localized.title,
      definition: localized.definition,
      category: localized.category,
    };
  });
}

function normalizeBoardData(data, cardsData) {
  if (!data || typeof data !== "object") {
    return {
      availableCards: cardsData,
      boardCards: [],
      userCards: [],
    };
  }

  const rawBoardCards = Array.isArray(data.boardCards) ? data.boardCards : [];
  const boardCards = localizeBoardCards(rawBoardCards, cardsData);
  const userCards = Array.isArray(data.userCards)
    ? data.userCards
    : boardCards.filter((card) => card.category === "free");
  const boardCardIds = new Set(
    boardCards
      .filter((card) => card.category !== "free")
      .map((card) => String(card.id)),
  );
  const availableCards = cardsData.filter(
    (card) => !boardCardIds.has(String(card.id)),
  );

  return {
    availableCards,
    boardCards,
    userCards,
  };
}

export default function RucheWorkspace({
  initialBoardData,
  loadKey,
  resetSignal = 0,
  onStateChange,
  canEdit = true,
  canNote = false,
  requireSaveBeforeNote = false,
  onRequireSaveBeforeNote,
  requestedNoteCardId = null,
  onRequestedNoteHandled,
}) {
  const { user } = useAuth();
  const { language, t, dateLocale } = useLanguage();
  const localizedCardsData =
    language === "en" ? cardsEn : language === "nl" ? cardsNl : cardsFr;
  const cardsData = useMemo(
    () => toCanonicalCards(localizedCardsData, language),
    [language, localizedCardsData],
  );
  const [availableCards, setAvailableCards] = useState(
    () => normalizeBoardData(initialBoardData, cardsData).availableCards,
  );
  const [boardCards, setBoardCards] = useState(
    () => normalizeBoardData(initialBoardData, cardsData).boardCards,
  );
  const [userCards, setUserCards] = useState(
    () => normalizeBoardData(initialBoardData, cardsData).userCards,
  );
  const [showModal, setShowModal] = useState(false);
  const [inputText, setInputText] = useState("");
  const [cardColor, setCardColor] = useState("lime");
  const [selectedCardIds, setSelectedCardIds] = useState(() => new Set());
  const [activeLoadKey, setActiveLoadKey] = useState(loadKey);
  const [activeResetSignal, setActiveResetSignal] = useState(resetSignal);
  const [noteModalCardId, setNoteModalCardId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [isEditingCardNote, setIsEditingCardNote] = useState(false);
  const [pendingReturnCardIds, setPendingReturnCardIds] = useState([]);
  const [showDeleteCardNoteModal, setShowDeleteCardNoteModal] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(COMPACT_EDITOR_MEDIA_QUERY).matches;
  });
  const [isLibraryOpen, setIsLibraryOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia(COMPACT_EDITOR_MEDIA_QUERY).matches;
  });
  const [boardZoom, setBoardZoom] = useState(1);

  useEffect(() => {
    if (loadKey === activeLoadKey) return;

    const initial = normalizeBoardData(initialBoardData, cardsData);
    setAvailableCards(initial.availableCards);
    setBoardCards(initial.boardCards);
    setUserCards(initial.userCards);
    setSelectedCardIds(new Set());
    setActiveLoadKey(loadKey);
  }, [activeLoadKey, cardsData, initialBoardData, loadKey]);

  useEffect(() => {
    setBoardCards((previousBoardCards) => {
      const localizedBoardCards = localizeBoardCards(
        previousBoardCards,
        cardsData,
      );

      const boardCardIds = new Set(
        localizedBoardCards
          .filter((card) => card.category !== "free")
          .map((card) => String(card.id)),
      );

      setAvailableCards(
        cardsData.filter((card) => !boardCardIds.has(String(card.id))),
      );

      return localizedBoardCards;
    });
  }, [cardsData]);

  useEffect(() => {
    onStateChange?.({
      availableCards,
      boardCards,
      userCards,
    });
  }, [availableCards, boardCards, userCards, onStateChange]);

  useEffect(() => {
    if (!noteModalCardId) return;

    const hasCard = boardCards.some((card) => card.id === noteModalCardId);
    if (!hasCard) {
      setNoteModalCardId(null);
      setNoteDraft("");
      setIsEditingCardNote(false);
    }
  }, [boardCards, noteModalCardId]);

  useEffect(() => {
    document.body.style.overflow = noteModalCardId ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [noteModalCardId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia(COMPACT_EDITOR_MEDIA_QUERY);
    const syncLayout = (matches) => {
      setIsCompactLayout(matches);
      setIsLibraryOpen(!matches);
    };

    syncLayout(mediaQuery.matches);

    const handleChange = (event) => {
      syncLayout(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!requestedNoteCardId) return;

    const requestedCard =
      boardCards.find((card) => card.id === requestedNoteCardId) || null;
    if (!requestedCard) return;

    const existingComment = getCardComment(requestedCard);
    setNoteModalCardId(requestedCard.id);
    setNoteDraft(existingComment?.message || "");
    setIsEditingCardNote(!existingComment?.message);
    onRequestedNoteHandled?.();
  }, [boardCards, onRequestedNoteHandled, requestedNoteCardId]);

  useDeviceDetection();

  const orderMap = useMemo(() => {
    const map = {};
    cardsData.forEach((c, i) => {
      map[c.id] = i;
    });
    return map;
  }, [cardsData]);

  const handleDropCard = (card, position, fromLibrary = false) => {
    if (!canEdit) return;

    if (fromLibrary && card.category !== "free") {
      setAvailableCards((prev) => prev.filter((c) => c.id !== card.id));
    }
    setBoardCards((prev) => {
      const exists = prev.find((c) => c.id === card.id);
      if (exists) {
        return prev.map((c) => (c.id === card.id ? { ...c, position } : c));
      }
      return [...prev, { ...card, position }];
    });
  };

  const handleMoveCard = (cardId, position) => {
    if (!canEdit) return;

    setBoardCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, position } : card)),
    );
  };

  const handleMoveCards = (cardUpdates) => {
    if (!canEdit) return;

    const positionsById = new Map(
      cardUpdates.map(({ id, position }) => [id, position]),
    );

    setBoardCards((prev) =>
      prev.map((card) => {
        const nextPosition = positionsById.get(card.id);
        return nextPosition ? { ...card, position: nextPosition } : card;
      }),
    );
  };

  const handleToggleCardSelection = (cardId) => {
    if (!canEdit) return;

    setSelectedCardIds((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedCardIds((prev) => (prev.size ? new Set() : prev));
  };

  const applyReturnCardsToLibrary = (cards) => {
    if (!canEdit || !cards.length) return false;

    const cardIds = new Set(cards.map((card) => card.id));
    const regularCards = cards
      .filter((card) => card.category !== "free")
      .map(stripCardComment);
    const freeCards = cards.filter((card) => card.category === "free");

    if (regularCards.length) {
      setAvailableCards((prev) =>
        [...prev.filter((c) => !cardIds.has(c.id)), ...regularCards].sort(
          (a, b) => (orderMap[a.id] || 0) - (orderMap[b.id] || 0),
        ),
      );
    }

    if (freeCards.length) {
      setUserCards((prev) => prev.filter((card) => !cardIds.has(card.id)));
    }

    setBoardCards((prev) => prev.filter((card) => !cardIds.has(card.id)));
    setSelectedCardIds((prev) => {
      const nextSet = new Set(prev);
      cards.forEach((card) => nextSet.delete(card.id));
      return nextSet;
    });

    return true;
  };

  const handleReturnCardsToLibrary = (cards) => {
    if (!canEdit || !cards.length) return false;

    const cardsWithComment = cards.filter((card) => {
      const comment = getCardComment(card);
      return Boolean(comment?.message?.trim());
    });

    if (cardsWithComment.length) {
      setPendingReturnCardIds(cards.map((card) => card.id));
      return false;
    }

    return applyReturnCardsToLibrary(cards);
  };

  const handleReturnToLibrary = (card) => {
    return handleReturnCardsToLibrary([card]);
  };

  const handleOpenCardNote = (card) => {
    if (!canNote) {
      if (requireSaveBeforeNote) {
        onRequireSaveBeforeNote?.(card.id);
      }
      return;
    }

    const existingComment = getCardComment(card);
    setNoteModalCardId(card.id);
    setNoteDraft(existingComment?.message || "");
    setIsEditingCardNote(!existingComment?.message);
  };

  const handleCloseCardNoteModal = () => {
    setNoteModalCardId(null);
    setNoteDraft("");
    setIsEditingCardNote(false);
  };

  const handleStartEditingCardNote = () => {
    if (!canNote || !noteModalCardId) return;

    const activeCard = boardCards.find((card) => card.id === noteModalCardId);
    const existingComment = getCardComment(activeCard);
    setNoteDraft(existingComment?.message || "");
    setIsEditingCardNote(true);
  };

  const handleCancelCardNoteEdit = () => {
    const activeCard = boardCards.find((card) => card.id === noteModalCardId);
    const existingComment = getCardComment(activeCard);

    if (existingComment?.message) {
      setNoteDraft(existingComment.message);
      setIsEditingCardNote(false);
      return;
    }

    handleCloseCardNoteModal();
  };

  const handleSaveCardNote = () => {
    if (!canNote || !noteModalCardId) return;

    const message = noteDraft.trim();
    if (!message) return;

    const now = new Date().toISOString();
    const actor = {
      id: user?.id || null,
      username: user?.username || null,
      email: user?.email || null,
    };

    setBoardCards((prev) =>
      prev.map((card) => {
        if (card.id !== noteModalCardId) return card;

        const existingComment = getCardComment(card);
        const isNewComment = !existingComment?.message;

        return {
          ...card,
          comment: {
            message,
            createdAt: existingComment?.createdAt || now,
            createdBy: existingComment?.createdBy || actor,
            updatedAt: now,
            updatedBy: isNewComment
              ? existingComment?.createdBy || actor
              : actor,
          },
        };
      }),
    );

    setNoteDraft(message);
    setIsEditingCardNote(false);
  };

  const handleDeleteCardNote = () => {
    if (!canNote || !noteModalCardId) return;

    setBoardCards((prev) =>
      prev.map((card) => {
        if (card.id !== noteModalCardId) return card;
        return stripCardComment(card);
      }),
    );

    setNoteDraft("");
    setIsEditingCardNote(true);
  };

  const confirmPendingCardReturn = () => {
    const pendingIds = new Set(pendingReturnCardIds);
    const cards = boardCards.filter((card) => pendingIds.has(card.id));
    applyReturnCardsToLibrary(cards);
    setPendingReturnCardIds([]);
  };

  const handleAddUserCard = () => {
    if (!canEdit) return;
    if (userCards.length >= 10 || !inputText.trim()) return;

    const defaultPosition = {
      x: 300 + Math.random() * 50,
      y: 200 + Math.random() * 50,
    };

    const newCard = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      title: inputText,
      category: "free",
      color: cardColor,
      position: defaultPosition,
    };
    setBoardCards((prev) => [...prev, newCard]);
    setUserCards((prev) => [...prev, newCard]);
    setShowModal(false);
    setInputText("");
    setCardColor("lime");
  };

  useEffect(() => {
    if (resetSignal === activeResetSignal) return;
    if (canEdit) {
      setBoardCards([]);
      setAvailableCards(cardsData);
      setUserCards([]);
      setSelectedCardIds(new Set());
      handleCloseCardNoteModal();
    }
    setActiveResetSignal(resetSignal);
  }, [activeResetSignal, resetSignal, canEdit, cardsData]);

  const activeNoteCard = noteModalCardId
    ? boardCards.find((card) => card.id === noteModalCardId) || null
    : null;
  const activeNote = getCardComment(activeNoteCard);
  const hasActiveNote = Boolean(activeNote?.message?.trim());

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={`app editor-app ${isLibraryOpen ? "library-open" : ""}`}>
        <div className="editor-app__library-panel">
          <CardLibrary
            cards={availableCards}
            onFreeSpaceClick={() => setShowModal(true)}
            userCards={userCards.length}
          />
        </div>
        {isCompactLayout && isLibraryOpen ? (
          <button
            type="button"
            className="editor-app__library-backdrop"
            aria-label={t("workspace.closeLibrary")}
            onClick={() => setIsLibraryOpen(false)}
          />
        ) : null}
        <div className="editor-app__board-panel">
          <HiveBoard
            cards={boardCards}
            onDropCard={handleDropCard}
            onMoveCard={handleMoveCard}
            onMoveCards={handleMoveCards}
            onReturnToLibrary={handleReturnToLibrary}
            onReturnCardsToLibrary={handleReturnCardsToLibrary}
            selectedCardIds={selectedCardIds}
            onToggleCardSelection={handleToggleCardSelection}
            onClearSelection={handleClearSelection}
            onOpenCardNote={handleOpenCardNote}
            noteLocked={requireSaveBeforeNote}
            isCompactLayout={isCompactLayout}
            isLibraryOpen={isLibraryOpen}
            onToggleLibrary={() => setIsLibraryOpen((current) => !current)}
            onZoomChange={setBoardZoom}
            resetSignal={resetSignal}
          />
        </div>
        <CustomDragPreview zoom={boardZoom} />
      </div>
      <AddCardModal
        show={canEdit && showModal}
        onClose={() => setShowModal(false)}
        onValidate={handleAddUserCard}
        inputText={inputText}
        setInputText={setInputText}
        selectedColor={cardColor}
        setSelectedColor={setCardColor}
        userCardsCount={userCards.length}
      />
      {noteModalCardId && activeNoteCard ? (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseCardNoteModal();
            }
          }}
        >
          <div className="modal-box comments-modal card-note-modal">
            <h2>{t("workspace.cardNoteTitle")}</h2>
            <button
              type="button"
              className="modal-close-btn"
              onClick={handleCloseCardNoteModal}
              aria-label={t("common.close")}
            >
              x
            </button>

            <p className="card-note-card-title">
              {t("workspace.cardLabel")} : {activeNoteCard.title}
            </p>

            {hasActiveNote ? (
              <div className="comment-thread card-note-thread">
                <div className="comment-item card-note-item">
                  <div className="comment-header">
                    <strong>
                      {getUserLabel(
                        activeNote.updatedBy || activeNote.createdBy,
                        t("common.unknownUser"),
                      )}
                    </strong>
                    <span className="comment-date">
                      {formatDateTime(
                        activeNote.updatedAt || activeNote.createdAt,
                        dateLocale,
                      )}
                    </span>
                  </div>
                  <p className="comment-message">{activeNote.message}</p>
                  <div className="card-note-meta">
                    <p>
                      {t("workspace.createdBy", {
                        date: formatDateTime(activeNote.createdAt, dateLocale),
                        user: getUserLabel(
                          activeNote.createdBy,
                          t("common.unknownUser"),
                        ),
                      })}
                    </p>
                    <p>
                      {t("workspace.updatedBy", {
                        date: formatDateTime(activeNote.updatedAt, dateLocale),
                        user: getUserLabel(
                          activeNote.updatedBy,
                          t("common.unknownUser"),
                        ),
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="comments-empty">{t("workspace.noCardNote")}</p>
            )}

            {canNote ? (
              <>
                {isEditingCardNote ? (
                  <div className="comments-new card-note-editor">
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key !== "Enter" ||
                          event.shiftKey ||
                          event.nativeEvent.isComposing
                        ) {
                          return;
                        }

                        event.preventDefault();
                        handleSaveCardNote();
                      }}
                      placeholder={t(
                        hasActiveNote
                          ? "workspace.editCardNotePlaceholder"
                          : "workspace.addCardNotePlaceholder",
                      )}
                      rows={4}
                      maxLength={1200}
                      autoFocus
                    />
                  </div>
                ) : null}

                <div className="comment-actions card-note-actions">
                  {hasActiveNote && !isEditingCardNote ? (
                    <>
                      <button
                        type="button"
                        className="comment-action-btn"
                        onClick={handleStartEditingCardNote}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="comment-action-btn comment-action-btn--danger"
                        onClick={() => setShowDeleteCardNoteModal(true)}
                      >
                        {t("common.delete")}
                      </button>
                    </>
                  ) : null}

                  {isEditingCardNote ? (
                    <>
                      {hasActiveNote ? (
                        <button
                          type="button"
                          className="comment-action-btn comment-action-btn--danger"
                          onClick={() => setShowDeleteCardNoteModal(true)}
                        >
                          {t("common.delete")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="comment-action-btn"
                        onClick={handleCancelCardNoteEdit}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        type="button"
                        className="comment-action-btn card-note-save-btn"
                        onClick={handleSaveCardNote}
                      >
                        {hasActiveNote ? t("common.save") : t("workspace.add")}
                      </button>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <UnifiedPromptModal
        isOpen={pendingReturnCardIds.length > 0}
        title={t("workspace.deleteCardNotesTitle")}
        message={
          pendingReturnCardIds.length === 1
            ? t("workspace.deleteSingleCardNoteMessage")
            : t("workspace.deleteMultipleCardNoteMessage")
        }
        confirmLabel={t("workspace.continueDeleteCardNotes")}
        confirmClassName="danger"
        onCancel={() => setPendingReturnCardIds([])}
        onConfirm={confirmPendingCardReturn}
      />

      <UnifiedPromptModal
        isOpen={showDeleteCardNoteModal}
        title={t("workspace.deleteCardNoteTitle")}
        message={t("workspace.irreversible")}
        confirmLabel={t("common.delete")}
        confirmClassName="danger"
        onCancel={() => setShowDeleteCardNoteModal(false)}
        onConfirm={() => {
          setShowDeleteCardNoteModal(false);
          handleDeleteCardNote();
        }}
      />
    </DndProvider>
  );
}
