import { useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import CardLibrary from "./components/CardLibrary";
import HiveBoard from "./components/HiveBoard";
import Toolbar from "./components/Toolbar";
import cardsData from "./data/cards.json";
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
      <div className="titre">
        <img src="./hexagone.png" alt="hexagone" />
        <h1>La Ruche</h1>
        <img src="./abeille.png" alt="abeille" />
      </div>

      <div className="app">
        <Toolbar onReset={resetHive} />
        <CardLibrary cards={availableCards} />
        <HiveBoard
          cards={boardCards}
          onDropCard={handleDropCard}
          onReturnToLibrary={handleReturnToLibrary}
        />
      </div>
      <footer>
        <a href="https://www.peca.be/" target="_blank">
          <img src="./data/logos/peca.svg" alt="logo PECA" />
        </a>
        <a href="https://web.umons.ac.be/" target="_blank">
          <img src="./data/logos/umons.png" alt="logo UMons" />
        </a>
        <a href="https://www.unamur.be/" target="_blank">
          <img src="./data/logos/unamur.svg" alt="logo UNamur" />
        </a>
        <a href="https://www.uliege.be/" target="_blank">
          <img src="./data/logos/uliège.png" alt="logo ULiège" />
        </a>
      </footer>
    </DndProvider>
  );
}
