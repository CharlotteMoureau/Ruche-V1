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
  canComment = false,
  requireSaveBeforeComment = false,
  onRequireSaveBeforeComment,
  requestedCommentCardId = null,
  onRequestedCommentHandled,
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
  const [selectedCardIds, setSelectedCardIds] = useState(() => new Set());
  const [activeLoadKey, setActiveLoadKey] = useState(loadKey);
  const [activeResetSignal, setActiveResetSignal] = useState(resetSignal);
  const [commentModalCardId, setCommentModalCardId] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [pendingReturnCardIds, setPendingReturnCardIds] = useState([]);
  const [showDeleteCardCommentModal, setShowDeleteCardCommentModal] =
    useState(false);

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
    const localizedBoardCards = localizeBoardCards(boardCards, cardsData);
    setBoardCards(localizedBoardCards);

    const boardCardIds = new Set(
      localizedBoardCards
        .filter((card) => card.category !== "free")
        .map((card) => String(card.id)),
    );
    setAvailableCards(
      cardsData.filter((card) => !boardCardIds.has(String(card.id))),
    );
  }, [cardsData]);

  useEffect(() => {
    onStateChange?.({
      availableCards,
      boardCards,
      userCards,
    });
  }, [availableCards, boardCards, userCards, onStateChange]);

  useEffect(() => {
    if (!commentModalCardId) return;

    const hasCard = boardCards.some((card) => card.id === commentModalCardId);
    if (!hasCard) {
      setCommentModalCardId(null);
      setCommentDraft("");
    }
  }, [boardCards, commentModalCardId]);

  useEffect(() => {
    document.body.style.overflow = commentModalCardId ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [commentModalCardId]);

  useEffect(() => {
    if (!requestedCommentCardId) return;

    const requestedCard =
      boardCards.find((card) => card.id === requestedCommentCardId) || null;
    if (!requestedCard) return;

    const existingComment = getCardComment(requestedCard);
    setCommentModalCardId(requestedCard.id);
    setCommentDraft(existingComment?.message || "");
    onRequestedCommentHandled?.();
  }, [boardCards, onRequestedCommentHandled, requestedCommentCardId]);

  useDeviceDetection();

  const orderMap = useMemo(() => {
    const map = {};
    cardsData.forEach((c, i) => {
      map[c.id] = i;
    });
    return map;
  }, []);

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

  const handleOpenCardComment = (card) => {
    if (!canComment) {
      if (requireSaveBeforeComment) {
        onRequireSaveBeforeComment?.(card.id);
      }
      return;
    }

    const existingComment = getCardComment(card);
    setCommentModalCardId(card.id);
    setCommentDraft(existingComment?.message || "");
  };

  const handleCloseCardCommentModal = () => {
    setCommentModalCardId(null);
    setCommentDraft("");
  };

  const handleSaveCardComment = () => {
    if (!canComment || !commentModalCardId) return;

    const message = commentDraft.trim();
    if (!message) return;

    const now = new Date().toISOString();
    const actor = {
      id: user?.id || null,
      username: user?.username || null,
      email: user?.email || null,
    };

    setBoardCards((prev) =>
      prev.map((card) => {
        if (card.id !== commentModalCardId) return card;

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

    handleCloseCardCommentModal();
  };

  const handleDeleteCardComment = () => {
    if (!canComment || !commentModalCardId) return;

    setBoardCards((prev) =>
      prev.map((card) => {
        if (card.id !== commentModalCardId) return card;
        return stripCardComment(card);
      }),
    );

    handleCloseCardCommentModal();
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
      position: defaultPosition,
    };
    setBoardCards((prev) => [...prev, newCard]);
    setUserCards((prev) => [...prev, newCard]);
    setShowModal(false);
    setInputText("");
  };

  useEffect(() => {
    if (resetSignal === activeResetSignal) return;
    if (canEdit) {
      setBoardCards([]);
      setAvailableCards(cardsData);
      setUserCards([]);
      setSelectedCardIds(new Set());
      handleCloseCardCommentModal();
    }
    setActiveResetSignal(resetSignal);
  }, [activeResetSignal, resetSignal, canEdit, cardsData]);

  const activeCommentCard = commentModalCardId
    ? boardCards.find((card) => card.id === commentModalCardId) || null
    : null;
  const activeComment = getCardComment(activeCommentCard);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app editor-app">
        <CardLibrary
          cards={availableCards}
          onFreeSpaceClick={() => setShowModal(true)}
          userCards={userCards.length}
        />
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
          onOpenCardComment={handleOpenCardComment}
          commentLocked={requireSaveBeforeComment}
        />
        <CustomDragPreview />
      </div>
      <AddCardModal
        show={canEdit && showModal}
        onClose={() => setShowModal(false)}
        onValidate={handleAddUserCard}
        inputText={inputText}
        setInputText={setInputText}
        userCardsCount={userCards.length}
      />
      {commentModalCardId && activeCommentCard ? (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseCardCommentModal();
            }
          }}
        >
          <div className="modal-box comments-modal card-comment-modal">
            <h2>{t("workspace.cardCommentTitle")}</h2>
            <button
              type="button"
              className="modal-close-btn"
              onClick={handleCloseCardCommentModal}
              aria-label={t("common.close")}
            >
              x
            </button>

            <p className="card-comment-card-title">
              {t("workspace.cardLabel")} : {activeCommentCard.title}
            </p>

            {activeComment?.message ? (
              <div className="card-comment-meta">
                <p>
                  {t("workspace.createdBy", {
                    date: formatDateTime(activeComment.createdAt, dateLocale),
                    user: getUserLabel(
                      activeComment.createdBy,
                      t("common.unknownUser"),
                    ),
                  })}
                </p>
                <p>
                  {t("workspace.updatedBy", {
                    date: formatDateTime(activeComment.updatedAt, dateLocale),
                    user: getUserLabel(
                      activeComment.updatedBy,
                      t("common.unknownUser"),
                    ),
                  })}
                </p>
              </div>
            ) : (
              <p className="comments-empty">{t("workspace.noCardComment")}</p>
            )}

            {canComment ? (
              <>
                <div className="comments-new card-comment-editor">
                  <textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key !== "Enter" ||
                        event.shiftKey ||
                        event.nativeEvent.isComposing
                      ) {
                        return;
                      }

                      event.preventDefault();
                      handleSaveCardComment();
                    }}
                    placeholder={t("workspace.addCardCommentPlaceholder")}
                    rows={4}
                    maxLength={1200}
                    autoFocus
                  />
                </div>
                <div className="card-comment-actions">
                  {activeComment?.message ? (
                    <button
                      type="button"
                      className="btn card-comment-delete"
                      onClick={() => setShowDeleteCardCommentModal(true)}
                    >
                      {t("common.delete")}
                    </button>
                  ) : null}
                  <div className="card-comment-actions-right">
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={handleCloseCardCommentModal}
                    >
                      {t("common.cancel")}
                    </button>
                    <button type="button" onClick={handleSaveCardComment}>
                      {activeComment?.message
                        ? t("common.save")
                        : t("workspace.add")}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <UnifiedPromptModal
        isOpen={pendingReturnCardIds.length > 0}
        title={t("workspace.deleteCardCommentsTitle")}
        message={
          pendingReturnCardIds.length === 1
            ? t("workspace.deleteSingleCardCommentMessage")
            : t("workspace.deleteMultipleCardCommentMessage")
        }
        confirmLabel={t("workspace.continueDeleteCardComments")}
        confirmClassName="danger"
        onCancel={() => setPendingReturnCardIds([])}
        onConfirm={confirmPendingCardReturn}
      />

      <UnifiedPromptModal
        isOpen={showDeleteCardCommentModal}
        title={t("workspace.deleteCardCommentTitle")}
        message={t("workspace.irreversible")}
        confirmLabel={t("common.delete")}
        confirmClassName="danger"
        onCancel={() => setShowDeleteCardCommentModal(false)}
        onConfirm={() => {
          setShowDeleteCardCommentModal(false);
          handleDeleteCardComment();
        }}
      />
    </DndProvider>
  );
}
