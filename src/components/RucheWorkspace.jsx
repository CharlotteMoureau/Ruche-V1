import { useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import CardLibrary from "./CardLibrary";
import HiveBoard from "./HiveBoard";
import Toolbar from "./Toolbar";
import cardsData from "../data/cards.json";
import Footer from "./Footer";
import CustomDragPreview from "./CustomDragPreview";
import AddCardModal from "./ModalFree";
import { useDeviceDetection } from "../hooks/useDeviceDetection";
import { useAuth } from "../context/AuthContext";

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getUserLabel(actor) {
  return actor?.username || actor?.email || "Utilisateur inconnu";
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

function normalizeBoardData(data) {
  if (!data || typeof data !== "object") {
    return {
      availableCards: cardsData,
      boardCards: [],
      userCards: [],
    };
  }

  const boardCards = Array.isArray(data.boardCards) ? data.boardCards : [];
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
  onStateChange,
  canEdit = true,
  canComment = false,
  onOpenComments,
  commentCount = 0,
}) {
  const { user } = useAuth();
  const [availableCards, setAvailableCards] = useState(
    () => normalizeBoardData(initialBoardData).availableCards,
  );
  const [boardCards, setBoardCards] = useState(
    () => normalizeBoardData(initialBoardData).boardCards,
  );
  const [userCards, setUserCards] = useState(
    () => normalizeBoardData(initialBoardData).userCards,
  );
  const [showModal, setShowModal] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedCardIds, setSelectedCardIds] = useState(() => new Set());
  const [activeLoadKey, setActiveLoadKey] = useState(loadKey);
  const [commentModalCardId, setCommentModalCardId] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");

  useEffect(() => {
    if (loadKey === activeLoadKey) return;

    const initial = normalizeBoardData(initialBoardData);
    setAvailableCards(initial.availableCards);
    setBoardCards(initial.boardCards);
    setUserCards(initial.userCards);
    setSelectedCardIds(new Set());
    setActiveLoadKey(loadKey);
  }, [activeLoadKey, initialBoardData, loadKey]);

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

  const handleReturnCardsToLibrary = (cards) => {
    if (!canEdit || !cards.length) return;

    const cardsWithComment = cards.filter((card) => {
      const comment = getCardComment(card);
      return Boolean(comment?.message?.trim());
    });

    if (cardsWithComment.length) {
      const promptMessage =
        cardsWithComment.length === 1
          ? "Cette carte contient un commentaire. La remettre dans la bibliotheque supprimera ce commentaire. Continuer ?"
          : "Certaines cartes contiennent un commentaire. Les remettre dans la bibliotheque supprimera ces commentaires. Continuer ?";

      const shouldDiscard = window.confirm(promptMessage);
      if (!shouldDiscard) {
        return;
      }
    }

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
  };

  const handleReturnToLibrary = (card) => {
    handleReturnCardsToLibrary([card]);
  };

  const handleOpenCardComment = (card) => {
    if (!canComment) return;

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
            updatedBy: isNewComment ? existingComment?.createdBy || actor : actor,
          },
        };
      }),
    );

    handleCloseCardCommentModal();
  };

  const handleDeleteCardComment = () => {
    if (!canComment || !commentModalCardId) return;

    const confirmed = window.confirm("Supprimer ce commentaire de carte ?");
    if (!confirmed) return;

    setBoardCards((prev) =>
      prev.map((card) => {
        if (card.id !== commentModalCardId) return card;
        return stripCardComment(card);
      }),
    );

    handleCloseCardCommentModal();
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

  const resetHive = () => {
    if (!canEdit) return;
    setBoardCards([]);
    setAvailableCards(cardsData);
    setUserCards([]);
    setSelectedCardIds(new Set());
    handleCloseCardCommentModal();
  };

  const activeCommentCard = commentModalCardId
    ? boardCards.find((card) => card.id === commentModalCardId) || null
    : null;
  const activeComment = getCardComment(activeCommentCard);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app editor-app">
        <Toolbar
          onReset={resetHive}
          onOpenComments={onOpenComments}
          commentCount={commentCount}
        />
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
            <h2>Commentaire de carte</h2>
            <button
              type="button"
              className="modal-close-btn"
              onClick={handleCloseCardCommentModal}
              aria-label="Fermer"
            >
              x
            </button>

            <p className="card-comment-card-title">Carte: {activeCommentCard.title}</p>

            {activeComment?.message ? (
              <div className="card-comment-meta">
                <p>
                  Cree le {formatDateTime(activeComment.createdAt)} par{" "}
                  {getUserLabel(activeComment.createdBy)}
                </p>
                <p>
                  Derniere edition le {formatDateTime(activeComment.updatedAt)} par{" "}
                  {getUserLabel(activeComment.updatedBy)}
                </p>
              </div>
            ) : (
              <p className="comments-empty">
                Aucun commentaire pour cette carte.
              </p>
            )}

            {canComment ? (
              <>
                <div className="comments-new card-comment-editor">
                  <textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Ajouter un commentaire a cette carte..."
                    rows={4}
                    maxLength={1200}
                    autoFocus
                  />
                </div>
                <div className="card-comment-actions">
                  <button type="button" onClick={handleSaveCardComment}>
                    {activeComment?.message ? "Enregistrer" : "Ajouter"}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={handleCloseCardCommentModal}
                  >
                    Annuler
                  </button>
                  {activeComment?.message ? (
                    <button
                      type="button"
                      className="btn card-comment-delete"
                      onClick={handleDeleteCardComment}
                    >
                      Supprimer
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <Footer />
    </DndProvider>
  );
}
