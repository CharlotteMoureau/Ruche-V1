import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import PasswordField from "../components/PasswordField";
import { useLanguage } from "../context/LanguageContext";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const data = await apiFetch("/auth/reset-password", {
        method: "POST",
        body: { token, password, passwordConfirm },
      });
      setMessage(data.message);
      setTimeout(() => navigate("/login"), 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!token) {
    return (
      <section className="page-shell">
        <h2>{t("resetPassword.invalidLink")}</h2>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <h2>{t("resetPassword.title")}</h2>
      <form onSubmit={onSubmit} className="form-grid">
        <PasswordField
          label={t("resetPassword.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <PasswordField
          label={t("resetPassword.passwordConfirm")}
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-info">{message}</p> : null}
        <button type="submit">{t("resetPassword.submit")}</button>
      </form>
    </section>
  );
}
