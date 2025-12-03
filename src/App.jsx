import { useState, useEffect } from "react";
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

export default function App() {
  const [availableCards, setAvailableCards] = useState(cardsData);
  const [boardCards, setBoardCards] = useState([]);
  const [userCards, setUserCards] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [inputText, setInputText] = useState("");

  // ✅ Détection iOS et ajout de la classe
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari =
      navigator.vendor &&
      navigator.vendor.indexOf("Apple") > -1 &&
      navigator.userAgent &&
      navigator.userAgent.indexOf("CriOS") == -1 &&
      navigator.userAgent.indexOf("FxiOS") == -1;
    if (isIOS || isSafari) {
      document.body.classList.add("ios");
    }
  }, []);

  const orderMap = {};
  cardsData.forEach((c, i) => {
    orderMap[c.id] = i;
  });

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

  const handleReturnToLibrary = (card) => {
    if (card.category !== "free") {
      setAvailableCards((prev) =>
        [...prev.filter((c) => c.id !== card.id), card].sort(
          (a, b) => (orderMap[a.id] || 0) - (orderMap[b.id] || 0)
        )
      );
    } else {
      setUserCards((prev) => prev.filter((c) => c.id !== card.id));
    }
    setBoardCards((prev) => prev.filter((c) => c.id !== card.id));
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
          onReturnToLibrary={handleReturnToLibrary}
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
