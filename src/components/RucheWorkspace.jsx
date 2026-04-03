import { useCallback, useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import CardLibrary from "./CardLibrary";
import HiveBoard from "./HiveBoard";
import HexCard from "./HexCard";
import cardsFr from "../data/cards.json";
import cardsEn from "../data/cards_en.json";
import cardsNl from "../data/cards_nl.json";
import CustomDragPreview from "./CustomDragPreview";
import AddCardModal from "./ModalFree";
import { useDeviceDetection } from "../hooks/useDeviceDetection";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import UnifiedPromptModal from "./UnifiedPromptModal";
import { filterCardsForHiveKind } from "../lib/hives";
import { BOARD_CARD_SIZE, clampBoardPosition } from "../lib/board";

const COMPACT_EDITOR_MEDIA_QUERY = "(max-width: 1200px)";
const HISTORY_LIMIT = 3;
const FREE_LIBRARY_SELECTION_CARD = {
  id: "__free-library-selection__",
  category: "free",
};

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

function cloneBoardState(state) {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }

  return JSON.parse(JSON.stringify(state));
}

export default function RucheWorkspace({
  initialBoardData,
  loadKey,
  hiveKind,
  resetSignal = 0,
  onStateChange,
  canEdit = true,
  canNote = false,
  onPersistCardNote,
  requireSaveBeforeNote = false,
  requestedNoteCardId = null,
  onRequestedNoteHandled,
  isTabletEditorMode = false,
  tabletUsageBlocked = false,
  activeEditorsLabel = "",
}) {
  const { user } = useAuth();
  const { language, t, dateLocale } = useLanguage();
  const localizedCardsData =
    language === "en" ? cardsEn : language === "nl" ? cardsNl : cardsFr;
  const cardsData = useMemo(
    () =>
      filterCardsForHiveKind(
        toCanonicalCards(localizedCardsData, language),
        hiveKind,
      ),
    [hiveKind, language, localizedCardsData],
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
  const [pendingReturnCardIds, setPendingReturnCardIds] = useState([]);
  const [showDeleteCardNoteModal, setShowDeleteCardNoteModal] = useState(false);
  const [isEditingCardNote, setIsEditingCardNote] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(COMPACT_EDITOR_MEDIA_QUERY).matches;
  });
  const [isLibraryOpen, setIsLibraryOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia(COMPACT_EDITOR_MEDIA_QUERY).matches;
  });
  const [boardZoom, setBoardZoom] = useState(1);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [isBoardSelectionMode, setIsBoardSelectionMode] = useState(false);
  const [selectedLibraryCardIds, setSelectedLibraryCardIds] = useState(
    () => new Set(),
  );
  const [isFreeCardSelected, setIsFreeCardSelected] = useState(false);
  const [pendingFreeCardAnchor, setPendingFreeCardAnchor] = useState(null);
  const [autoPlaceSignal, setAutoPlaceSignal] = useState(0);
  const [isBoardDragActive, setIsBoardDragActive] = useState(false);
  const [isLibraryDropHover, setIsLibraryDropHover] = useState(false);
  const [boardDragPreview, setBoardDragPreview] = useState(null);

  const snapshotState = useMemo(
    () => ({
      availableCards,
      boardCards,
      userCards,
      selectedCardIds: [...selectedCardIds],
    }),
    [availableCards, boardCards, selectedCardIds, userCards],
  );

  const pushUndoSnapshot = useCallback((snapshot) => {
    setUndoStack((prev) => {
      const next = [...prev, cloneBoardState(snapshot)];
      return next.slice(-HISTORY_LIMIT);
    });
    setRedoStack([]);
  }, []);

  const applySnapshot = useCallback((snapshot) => {
    setAvailableCards(snapshot.availableCards || []);
    setBoardCards(snapshot.boardCards || []);
    setUserCards(snapshot.userCards || []);
    setSelectedCardIds(new Set(snapshot.selectedCardIds || []));
  }, []);

  const handleUndo = useCallback(() => {
    if (!canEdit) return;

    setUndoStack((prev) => {
      if (!prev.length) return prev;

      const nextSnapshot = prev[prev.length - 1];
      setRedoStack((redoPrev) => {
        const next = [...redoPrev, cloneBoardState(snapshotState)];
        return next.slice(-HISTORY_LIMIT);
      });
      applySnapshot(nextSnapshot);
      return prev.slice(0, -1);
    });
  }, [applySnapshot, canEdit, snapshotState]);

  const handleRedo = useCallback(() => {
    if (!canEdit) return;

    setRedoStack((prev) => {
      if (!prev.length) return prev;

      const nextSnapshot = prev[prev.length - 1];
      setUndoStack((undoPrev) => {
        const next = [...undoPrev, cloneBoardState(snapshotState)];
        return next.slice(-HISTORY_LIMIT);
      });
      applySnapshot(nextSnapshot);
      return prev.slice(0, -1);
    });
  }, [applySnapshot, canEdit, snapshotState]);

  const handleCardDragStart = useCallback(() => {
    if (!canEdit) return;
    pushUndoSnapshot(snapshotState);
  }, [canEdit, pushUndoSnapshot, snapshotState]);

  useEffect(() => {
    if (loadKey === activeLoadKey) return;

    const initial = normalizeBoardData(initialBoardData, cardsData);
    setAvailableCards(initial.availableCards);
    setBoardCards(initial.boardCards);
    setUserCards(initial.userCards);
    setSelectedCardIds(new Set());
    setIsBoardSelectionMode(false);
    setSelectedLibraryCardIds(new Set());
    setUndoStack([]);
    setRedoStack([]);
    setActiveLoadKey(loadKey);
  }, [activeLoadKey, cardsData, initialBoardData, loadKey]);

  useEffect(() => {
    const isTypingTarget = (target) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName;

      return (
        target.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      );
    };

    const handleKeyDown = (event) => {
      if (!canEdit || isTypingTarget(event.target)) return;

      const key = String(event.key || "").toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;

      if (key === "a" && hasModifier) {
        event.preventDefault();
        if (boardCards.length > 0) {
          setSelectedCardIds(new Set(boardCards.map((card) => card.id)));
        }
        return;
      }

      if (!hasModifier) return;

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canEdit, handleRedo, handleUndo, boardCards]);

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

  useEffect(() => {
    const handleBoardDragState = (event) => {
      const dragging = Boolean(event.detail?.dragging);
      const overLibrary = Boolean(event.detail?.overLibrary);
      const previewCard = event.detail?.card || null;
      const previewPointer = event.detail?.pointer || null;

      if (isTabletEditorMode) {
        setIsBoardDragActive(false);
        setIsLibraryDropHover(false);
        setBoardDragPreview(null);
        return;
      }

      setIsBoardDragActive(dragging);
      setIsLibraryDropHover(dragging && overLibrary);
      setBoardDragPreview(
        dragging && overLibrary && previewCard && previewPointer
          ? { card: previewCard, pointer: previewPointer }
          : null,
      );
    };

    window.addEventListener("ruche:board-drag-state", handleBoardDragState);

    return () => {
      window.removeEventListener(
        "ruche:board-drag-state",
        handleBoardDragState,
      );
    };
  }, [isTabletEditorMode]);

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

    pushUndoSnapshot(snapshotState);

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

  const toggleLibraryCardSelection = useCallback(
    (cardId) => {
      if (!canEdit || !isTabletEditorMode) return;

      setSelectedLibraryCardIds((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) {
          next.delete(cardId);
        } else {
          next.add(cardId);
        }
        return next;
      });
    },
    [canEdit, isTabletEditorMode],
  );

  const clearLibrarySelection = useCallback(() => {
    setSelectedLibraryCardIds(new Set());
    setIsFreeCardSelected(false);
  }, []);

  const toggleFreeCardSelection = useCallback(() => {
    if (!canEdit || !isTabletEditorMode) return;
    if (userCards.length >= 10) return;
    setIsFreeCardSelected((prev) => !prev);
  }, [canEdit, isTabletEditorMode, userCards]);

  const selectedLibraryCards = useMemo(
    () => availableCards.filter((card) => selectedLibraryCardIds.has(card.id)),
    [availableCards, selectedLibraryCardIds],
  );
  const selectedLibraryCount =
    selectedLibraryCards.length + (isFreeCardSelected ? 1 : 0);
  const pendingLibraryCards = useMemo(() => {
    if (!isFreeCardSelected) return selectedLibraryCards;
    return [...selectedLibraryCards, FREE_LIBRARY_SELECTION_CARD];
  }, [isFreeCardSelected, selectedLibraryCards]);

  const handleGoToBoard = useCallback(() => {
    setIsLibraryOpen(false);

    if (!isTabletEditorMode || selectedLibraryCount === 0) return;

    setAutoPlaceSignal((current) => current + 1);
  }, [isTabletEditorMode, selectedLibraryCount]);

  const handlePlaceLibraryCards = useCallback(
    ({ anchor, cards }) => {
      if (!canEdit || !cards.length) return;

      const hasFreeCardSelection = cards.some(
        (card) => card.category === "free",
      );
      if (hasFreeCardSelection) {
        setPendingFreeCardAnchor(anchor);
        setShowModal(true);
      }

      const cardsToPlace = cards.filter((card) => card.category !== "free");
      if (!cardsToPlace.length) {
        setSelectedCardIds(new Set());
        setSelectedLibraryCardIds(new Set());
        setIsFreeCardSelected(false);
        return;
      }

      pushUndoSnapshot(snapshotState);

      const requestedIds = new Set(cardsToPlace.map((entry) => entry.id));

      setAvailableCards((prev) =>
        prev.filter((entry) => !requestedIds.has(entry.id)),
      );
      setBoardCards((prev) => {
        const existingIds = new Set(prev.map((entry) => entry.id));
        const uniqueCards = cardsToPlace.filter(
          (entry) => !existingIds.has(entry.id),
        );

        if (!uniqueCards.length) return prev;

        const columnCount = Math.min(3, uniqueCards.length);
        const spacingX = BOARD_CARD_SIZE * 0.9;
        const spacingY = BOARD_CARD_SIZE * 0.85;
        const totalRows = Math.ceil(uniqueCards.length / columnCount);

        const placements = uniqueCards.map((card, index) => {
          const row = Math.floor(index / columnCount);
          const col = index % columnCount;
          const cardsInRow = Math.min(
            columnCount,
            uniqueCards.length - row * columnCount,
          );

          const offsetX = (col - (cardsInRow - 1) / 2) * spacingX;
          const offsetY = (row - (totalRows - 1) / 2) * spacingY;

          return {
            ...card,
            position: clampBoardPosition({
              x: anchor.x + offsetX,
              y: anchor.y + offsetY,
            }),
          };
        });

        return [...prev, ...placements];
      });
      setSelectedCardIds(new Set());
      setSelectedLibraryCardIds(new Set());
      setIsFreeCardSelected(false);
    },
    [canEdit, pushUndoSnapshot, snapshotState],
  );

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

  const toggleBoardSelectionMode = useCallback(() => {
    if (!canEdit || !isTabletEditorMode) return;

    setIsBoardSelectionMode((current) => {
      const next = !current;
      if (!next) {
        setSelectedCardIds(new Set());
      }
      return next;
    });
  }, [canEdit, isTabletEditorMode]);

  const exitBoardSelectionMode = useCallback(() => {
    setIsBoardSelectionMode(false);
    setSelectedCardIds(new Set());
  }, []);

  const applyReturnCardsToLibrary = useCallback(
    (cards) => {
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
    },
    [canEdit, orderMap],
  );

  const handleReturnCardsToLibrary = useCallback(
    (cards) => {
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
    },
    [applyReturnCardsToLibrary, canEdit],
  );

  const handleReturnToLibrary = (card) => {
    return handleReturnCardsToLibrary([card]);
  };

  const returnSelectedBoardCards = useCallback(() => {
    if (!canEdit || selectedCardIds.size === 0) return;

    const selectedCards = boardCards.filter((card) =>
      selectedCardIds.has(card.id),
    );
    if (!selectedCards.length) return;

    pushUndoSnapshot(snapshotState);
    handleReturnCardsToLibrary(selectedCards);
  }, [
    boardCards,
    canEdit,
    handleReturnCardsToLibrary,
    pushUndoSnapshot,
    selectedCardIds,
    snapshotState,
  ]);

  const handleOpenCardNote = (card) => {
    const existingComment = getCardComment(card);
    setNoteModalCardId(card.id);
    setNoteDraft(existingComment?.message || "");

    if (canNote) {
      setIsEditingCardNote(!existingComment?.message);
      return;
    }

    setIsEditingCardNote(false);
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

  const handleSaveCardNote = async () => {
    if (!canNote || !noteModalCardId) return;

    const message = noteDraft.trim();
    if (!message) return;

    const now = new Date().toISOString();
    const actor = {
      id: user?.id || null,
      username: user?.username || null,
      email: user?.email || null,
    };

    const previousBoardCards = boardCards;
    const nextBoardCards = boardCards.map((card) => {
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
          updatedBy: isNewComment ? existingComment?.createdBy || actor : actor,
        },
      };
    });

    setBoardCards(nextBoardCards);

    setNoteDraft(message);
    setIsEditingCardNote(false);

    if (!onPersistCardNote) return;

    try {
      await onPersistCardNote({
        cardId: noteModalCardId,
        message,
        nextBoardData: {
          availableCards,
          boardCards: nextBoardCards,
          userCards,
        },
      });
    } catch {
      const activeCard = previousBoardCards.find(
        (card) => card.id === noteModalCardId,
      );
      const existingComment = getCardComment(activeCard);

      setBoardCards(previousBoardCards);
      setNoteDraft(existingComment?.message || "");
      setIsEditingCardNote(true);
    }
  };

  const handleDeleteCardNote = async () => {
    if (!canNote || !noteModalCardId) return;

    const previousBoardCards = boardCards;
    const nextBoardCards = boardCards.map((card) => {
      if (card.id !== noteModalCardId) return card;
      return stripCardComment(card);
    });

    setBoardCards(nextBoardCards);

    setNoteDraft("");
    setIsEditingCardNote(true);

    if (!onPersistCardNote) return;

    try {
      await onPersistCardNote({
        cardId: noteModalCardId,
        message: null,
        nextBoardData: {
          availableCards,
          boardCards: nextBoardCards,
          userCards,
        },
      });
    } catch {
      const activeCard = previousBoardCards.find(
        (card) => card.id === noteModalCardId,
      );
      const existingComment = getCardComment(activeCard);

      setBoardCards(previousBoardCards);
      setNoteDraft(existingComment?.message || "");
      setIsEditingCardNote(!existingComment?.message);
    }
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

    pushUndoSnapshot(snapshotState);

    const defaultPosition = pendingFreeCardAnchor
      ? clampBoardPosition(pendingFreeCardAnchor)
      : {
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
    setPendingFreeCardAnchor(null);
  };

  useEffect(() => {
    if (resetSignal === activeResetSignal) return;
    if (canEdit) {
      setBoardCards([]);
      setAvailableCards(cardsData);
      setUserCards([]);
      setSelectedCardIds(new Set());
      setIsBoardSelectionMode(false);
      setSelectedLibraryCardIds(new Set());
      setIsFreeCardSelected(false);
      setPendingFreeCardAnchor(null);
      setUndoStack([]);
      setRedoStack([]);
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
      <div
        className={`app editor-app ${isLibraryOpen ? "library-open" : ""} ${isBoardDragActive ? "is-board-dragging" : ""}`.trim()}
      >
        <div
          className={`editor-app__library-panel ${isLibraryDropHover ? "is-drop-hover" : ""}`.trim()}
        >
          <CardLibrary
            cards={availableCards}
            onFreeSpaceClick={() => {
              setPendingFreeCardAnchor(null);
              setShowModal(true);
            }}
            userCards={userCards.length}
            canEdit={canEdit}
            isTabletEditorMode={isTabletEditorMode}
            selectedCount={selectedLibraryCount}
            onClearSelected={clearLibrarySelection}
            onGoToBoard={handleGoToBoard}
            onToggleLibraryCardSelection={toggleLibraryCardSelection}
            selectedLibraryCardIds={selectedLibraryCardIds}
            isFreeCardSelected={isFreeCardSelected}
            onToggleFreeCardSelection={toggleFreeCardSelection}
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
            onCardDragStart={handleCardDragStart}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            selectedCardIds={selectedCardIds}
            boardSelectionMode={isBoardSelectionMode}
            onToggleCardSelection={handleToggleCardSelection}
            onClearSelection={handleClearSelection}
            onToggleBoardSelectionMode={toggleBoardSelectionMode}
            onExitBoardSelectionMode={exitBoardSelectionMode}
            onReturnSelectedCards={returnSelectedBoardCards}
            onOpenCardNote={handleOpenCardNote}
            noteLocked={requireSaveBeforeNote}
            canEdit={canEdit}
            isTabletEditorMode={isTabletEditorMode}
            isCompactLayout={isCompactLayout}
            isLibraryOpen={isLibraryOpen}
            onToggleLibrary={() => setIsLibraryOpen((current) => !current)}
            onZoomChange={setBoardZoom}
            resetSignal={resetSignal}
            pendingLibraryCards={pendingLibraryCards}
            onPlaceLibraryCards={handlePlaceLibraryCards}
            autoPlaceSignal={autoPlaceSignal}
            tabletUsageBlocked={tabletUsageBlocked}
            isCardDragging={isBoardDragActive}
          />
          {activeEditorsLabel ? (
            <p className="editor-active-badge">{activeEditorsLabel}</p>
          ) : null}
          {tabletUsageBlocked ? (
            <div
              className="editor-tablet-guard"
              role="status"
              aria-live="polite"
            >
              <p>{t("workspace.tabletOnlyMessage")}</p>
            </div>
          ) : null}
        </div>
        <CustomDragPreview zoom={boardZoom} />
        {boardDragPreview ? (
          <div
            style={{
              position: "fixed",
              left: boardDragPreview.pointer.x,
              top: boardDragPreview.pointer.y,
              transform: `translate(-50%, -50%) scale(${boardZoom})`,
              transformOrigin: "center center",
              pointerEvents: "none",
              zIndex: 12000,
            }}
            aria-hidden="true"
          >
            <HexCard card={boardDragPreview.card} onlyFront />
          </div>
        ) : null}
      </div>
      <AddCardModal
        show={canEdit && showModal}
        onClose={() => {
          setShowModal(false);
          setPendingFreeCardAnchor(null);
        }}
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
                      id="workspace-card-note"
                      name="cardNote"
                      aria-label={t(
                        hasActiveNote
                          ? "workspace.editCardNotePlaceholder"
                          : "workspace.addCardNotePlaceholder",
                      )}
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
            ) : (
              <p className="comments-empty">
                {t("workspace.cardNoteReadOnlyHint")}
              </p>
            )}
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
