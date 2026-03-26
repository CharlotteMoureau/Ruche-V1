import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

function EyeIcon({ visible }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {!visible ? (
        <path
          d="M4 20 20 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

export default function PasswordField({
  label,
  value,
  onChange,
  minLength,
  required = false,
  autoComplete,
}) {
  const { t } = useLanguage();
  const [isRevealing, setIsRevealing] = useState(false);

  const startReveal = () => setIsRevealing(true);
  const stopReveal = () => setIsRevealing(false);

  const onKeyDown = (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      startReveal();
    }
  };

  const onKeyUp = (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      stopReveal();
    }
  };

  return (
    <label className="password-field">
      {label}
      <div className="password-input-wrap">
        <input
          type={isRevealing ? "text" : "password"}
          value={value}
          onChange={onChange}
          minLength={minLength}
          required={required}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-visibility-button"
          title={t("passwordField.showPassword")}
          aria-label={t("passwordField.showPassword")}
          onMouseDown={startReveal}
          onMouseUp={stopReveal}
          onMouseLeave={stopReveal}
          onTouchStart={startReveal}
          onTouchEnd={stopReveal}
          onTouchCancel={stopReveal}
          onBlur={stopReveal}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
        >
          <EyeIcon visible={isRevealing} />
        </button>
      </div>
    </label>
  );
}
