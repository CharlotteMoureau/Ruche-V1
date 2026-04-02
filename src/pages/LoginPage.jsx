import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";
import { useLanguage } from "../context/LanguageContext";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(identifier, password);
      navigate("/profile");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-shell">
      <h2>{t("login.title")}</h2>
      <form onSubmit={onSubmit} className="form-grid">
        <label>
          {t("login.identifier")}
          <input
            id="login-identifier"
            name="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </label>

        <PasswordField
          label={t("login.password")}
          id="login-password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error ? <p className="form-error">{error}</p> : null}
        <button disabled={loading} type="submit">
          {loading ? t("login.submitting") : t("login.submit")}
        </button>
      </form>
      <p className="login-link-row">
        <Link to="/forgot-password" className="signup-link">
          {t("login.forgot")}
        </Link>
      </p>
      <p className="login-link-row">
        {t("login.noAccount")}{" "}
        <Link to="/register" className="signup-link">
          {t("login.register")}
        </Link>
      </p>
    </section>
  );
}
