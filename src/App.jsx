import { useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import CardLibrary from "./components/CardLibrary";
import HiveBoard from "./components/HiveBoard";
import Toolbar from "./components/Toolbar";
import cardsData from "./data/cards.json";
import Footer from "./components/Footer";
import CustomDragPreview from "./components/CustomDragPreview";
import "./styles/main.scss";

export default function App() {
  const [availableCards, setAvailableCards] = useState(cardsData);
  const [boardCards, setBoardCards] = useState([]);

  const handleDropCard = (card, position, fromLibrary = false) => {
    if (fromLibrary && card.category !== "free") {
      setAvailableCards((prev) => prev.filter((c) => c.id !== card.id));
    }

    setBoardCards((prev) => {
      const exists = prev.find((c) => c.id === card.id);
      if (exists) {
        return prev.map((c) => (c.id === card.id ? { ...c, position } : c));
      } else {
        return [...prev, { ...card, position }];
      }
    });
  };

  const handleReturnToLibrary = (card) => {
    if (card.category !== "free") {
      setAvailableCards((prev) => [...prev, card]);
    }
    setBoardCards((prev) => prev.filter((c) => c.id !== card.id));
  };

  const resetHive = () => {
    setBoardCards([]);
    setAvailableCards(cardsData);
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
        <CardLibrary cards={availableCards} />
        <HiveBoard
          cards={boardCards}
          onDropCard={handleDropCard}
          onReturnToLibrary={handleReturnToLibrary}
        />
        <CustomDragPreview />
      </div>
      <Footer />
    </DndProvider>
  );
}
