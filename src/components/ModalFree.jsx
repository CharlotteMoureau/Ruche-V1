import React, { useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function AddCardModal({
  show,
  onClose,
  onValidate,
  inputText,
  setInputText,
  userCardsCount,
  maxCards = 10,
}) {
  const { t } = useLanguage();
  const inputRef = useRef(null);

  useEffect(() => {
    if (show && inputRef.current) {
      inputRef.current.focus();
    }
  }, [show]);

  if (!show) return null;

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      onValidate();
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    if (value.length <= 50) {
      setInputText(value);
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
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={handleChange}
          placeholder={t("addCardModal.placeholder")}
          maxLength={50}
        />

        <p className="char-count">{inputText.length} / 50</p>

        <div className="modal-actions">
          <button className="btn" onClick={onValidate}>
            {t("addCardModal.validate")}
          </button>
          <button className="btn secondary" onClick={onClose}>
            {t("addCardModal.close")}
          </button>
        </div>

        <p className="counter-text">
          {userCardsCount} / {maxCards} {t("addCardModal.customCards")}
        </p>
      </div>
    </div>
  );
}
