import { useState, useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import CardLibrary from "./components/CardLibrary";
import HiveBoard from "./components/HiveBoard";
import Toolbar from "./components/Toolbar";
import cardsData from "./data/cards.json";
import Footer from "./components/Footer";
import CustomDragPreview from "./components/CustomDragPreview";
import "./styles/main.scss";
import AddCardModal from "./components/ModalFree";
import { useDeviceDetection } from "./hooks/useDeviceDetection";

export default function App() {
  const [availableCards, setAvailableCards] = useState(cardsData);
  const [boardCards, setBoardCards] = useState([]);
  const [userCards, setUserCards] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedCardIds, setSelectedCardIds] = useState(() => new Set());

  // Detect iOS/Safari and add class to document
  useDeviceDetection();

  // Memoize orderMap to avoid recalculating on every render
  const orderMap = useMemo(() => {
    const map = {};
    cardsData.forEach((c, i) => {
      map[c.id] = i;
    });
    return map;
  }, []);

  const handleDropCard = (card, position, fromLibrary = false) => {
    if (fromLibrary && card.category !== "free") {
      setAvailableCards((prev) => prev.filter((c) => c.id !== card.id));
    }
    setBoardCards((prev) => {
      const exists = prev.find((c) => c.id === card.id);
      if (exists)
        return prev.map((c) => (c.id === card.id ? { ...c, position } : c));
      return [...prev, { ...card, position }];
    });
  };

  const handleMoveCard = (cardId, position) => {
    setBoardCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, position } : card)),
    );
  };

  const handleMoveCards = (cardUpdates) => {
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
    if (!cards.length) return;

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
    setBoardCards([]);
    setAvailableCards(cardsData);
    setUserCards([]);
    setSelectedCardIds(new Set());
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <header className="titre">
        <img src="./hexagone.png" alt="hexagone" />
        <h1>La Ruche</h1>
        <img src="./abeille.png" alt="abeille" />
      </header>
      <div className="app">
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
        show={showModal}
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
