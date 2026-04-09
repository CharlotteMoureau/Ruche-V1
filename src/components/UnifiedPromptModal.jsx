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
  busy = false,
  confirmLoadingLabel,
  extraActionLoadingLabel,
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
  const isConfirmDisabled = confirmDisabled || busy;
  const resolvedConfirmLabel = confirmLabel || t("common.confirm");
  const resolvedConfirmText =
    busy && confirmLoadingLabel ? confirmLoadingLabel : resolvedConfirmLabel;
  const resolvedCancelLabel = cancelLabel || t("common.cancel");
  const resolvedExtraActionText =
    busy && extraActionLoadingLabel
      ? extraActionLoadingLabel
      : extraActionLabel;

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
    if (busy) return;

    if (event.target === event.currentTarget) {
      onCancel?.();
    }
  };

  const handleKeyDown = (event) => {
    if (busy) return;

    if (event.key === "Escape") {
      onCancel?.();
    }
    if (event.key === "Enter" && !isConfirmDisabled) {
      onConfirm?.();
    }
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

        <div className="form-grid unified-prompt-form">
          {mode === "prompt" ? (
            <label>
              {inputLabel || "Value"}
              <input
                id="unified-prompt-input"
                name="promptValue"
                ref={inputRef}
                type="text"
                value={value}
                onChange={(event) => onValueChange?.(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !isConfirmDisabled) {
                    event.preventDefault();
                    onConfirm?.();
                  }
                }}
                placeholder={inputPlaceholder}
                maxLength={100}
                disabled={busy}
              />
            </label>
          ) : null}

          <div className="modal-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={onCancel}
              disabled={busy}
            >
              {resolvedCancelLabel}
            </button>
            {onExtraAction && extraActionLabel ? (
              <button
                type="button"
                className={`btn ${extraActionClassName}`.trim()}
                onClick={onExtraAction}
                disabled={busy}
              >
                {resolvedExtraActionText}
              </button>
            ) : null}
            <button
              ref={confirmRef}
              type="button"
              className={`btn ${confirmClassName}`.trim()}
              disabled={isConfirmDisabled}
              onClick={() => {
                if (isConfirmDisabled) return;
                onConfirm?.();
              }}
            >
              {resolvedConfirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
