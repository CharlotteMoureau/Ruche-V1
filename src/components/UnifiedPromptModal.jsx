import { useEffect, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function UnifiedPromptModal({
  isOpen,
  title,
  message,
  mode = "confirm",
  value = "",
  onValueChange,
  inputLabel,
  inputPlaceholder,
  confirmLabel,
  cancelLabel,
  confirmDisabled = false,
  confirmClassName = "",
  onConfirm,
  onCancel,
  extraActionLabel,
  onExtraAction,
  extraActionClassName = "",
}) {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const confirmRef = useRef(null);
  const resolvedConfirmLabel = confirmLabel || t("common.confirm");
  const resolvedCancelLabel = cancelLabel || t("common.cancel");

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = window.setTimeout(() => {
      if (mode === "prompt") {
        inputRef.current?.focus();
        inputRef.current?.select();
      } else {
        confirmRef.current?.focus();
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onCancel?.();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      onCancel?.();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (confirmDisabled) return;
    onConfirm?.();
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        className="modal-box unified-prompt-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        {message ? <p className="unified-prompt-message">{message}</p> : null}

        <form onSubmit={handleSubmit} className="form-grid unified-prompt-form">
          {mode === "prompt" ? (
            <label>
              {inputLabel || "Value"}
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(event) => onValueChange?.(event.target.value)}
                placeholder={inputPlaceholder}
                maxLength={100}
              />
            </label>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onCancel}>
              {resolvedCancelLabel}
            </button>
            {onExtraAction && extraActionLabel ? (
              <button
                type="button"
                className={`btn ${extraActionClassName}`.trim()}
                onClick={onExtraAction}
              >
                {extraActionLabel}
              </button>
            ) : null}
            <button
              ref={confirmRef}
              type="submit"
              className={`btn ${confirmClassName}`.trim()}
              disabled={confirmDisabled}
            >
              {resolvedConfirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
