import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const CARD_COLORS = [
  { id: "lime", hex: "#8BB31D", labelKey: "addCardModal.colorCategories.lime" },
  { id: "pink", hex: "#E73458", labelKey: "addCardModal.colorCategories.pink" },
  {
    id: "purple",
    hex: "#AD498D",
    labelKey: "addCardModal.colorCategories.purple",
  },
  {
    id: "turquoise",
    hex: "#009F8C",
    labelKey: "addCardModal.colorCategories.turquoise",
  },
  {
    id: "orange",
    hex: "#EF7D00",
    labelKey: "addCardModal.colorCategories.orange",
  },
];

export default function AddCardModal({
  show,
  onClose,
  onValidate,
  inputText,
  setInputText,
  selectedColor,
  setSelectedColor,
  userCardsCount,
  maxCards = 10,
}) {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (show && inputRef.current) {
      inputRef.current.focus();
    }
    if (!show) {
      setErrorMessage("");
    }
  }, [show]);

  if (!show) return null;

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      setErrorMessage("");
      onClose();
    }
  };

  const handleClose = () => {
    setErrorMessage("");
    onClose();
  };

  const handleValidate = () => {
    if (!inputText.trim()) {
      setErrorMessage(t("addCardModal.emptyError"));
      return;
    }

    setErrorMessage("");
    onValidate();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      handleClose();
    } else if (e.key === "Enter") {
      handleValidate();
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    if (value.length <= 50) {
      setInputText(value);
      if (value.trim()) {
        setErrorMessage("");
      }
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="modal-box">
        <h2>{t("addCardModal.title")}</h2>

        <input
          id="add-card-title"
          name="cardTitle"
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={handleChange}
          placeholder={t("addCardModal.placeholder")}
          maxLength={50}
          aria-invalid={errorMessage ? "true" : "false"}
        />

        {errorMessage ? <p className="modal-error">{errorMessage}</p> : null}

        <p className="char-count">{inputText.length} / 50</p>

        <p className="color-picker-label">{t("addCardModal.colorLabel")}</p>
        <div className="color-picker">
          {CARD_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`color-swatch${selectedColor === c.id ? " selected" : ""}`}
              style={{ backgroundColor: c.hex }}
              onClick={() => setSelectedColor(c.id)}
              aria-label={t(c.labelKey)}
              data-label={t(c.labelKey)}
            />
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn danger" onClick={handleClose}>
            {t("addCardModal.close")}
          </button>
          <button className="btn" onClick={handleValidate}>
            {t("addCardModal.validate")}
          </button>
        </div>

        <p className="counter-text">
          {userCardsCount} / {maxCards} {t("addCardModal.customCards")}
        </p>
      </div>
    </div>
  );
}
