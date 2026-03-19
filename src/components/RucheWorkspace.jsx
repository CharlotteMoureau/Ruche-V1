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
}) {
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

    const cardIds = new Set(cards.map((card) => card.id));
    const regularCards = cards.filter((card) => card.category !== "free");
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
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app editor-app">
        <Toolbar onReset={resetHive} />
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
      <Footer />
    </DndProvider>
  );
}
