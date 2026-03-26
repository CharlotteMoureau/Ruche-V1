import { useState } from "react";
import { apiFetch } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const data = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="page-shell">
      <h2>{t("forgotPassword.title")}</h2>
      <form onSubmit={onSubmit} className="form-grid">
        <label>
          {t("forgotPassword.email")}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-info">{message}</p> : null}
        <button type="submit">{t("forgotPassword.submit")}</button>
      </form>
    </section>
  );
}
