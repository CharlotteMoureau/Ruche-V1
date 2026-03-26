import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function AppHeader() {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const { language, setLanguage, supportedLanguages, t } = useLanguage();
  const navigate = useNavigate();

  return (
    <header className="site-header">
      <Link to="/" className="brand-link">
        <img src="/hexagone.png" alt="hexagone" />
        <h1>La Ruche</h1>
        <img src="/abeille.png" alt="abeille" />
      </Link>

      <nav className="site-nav">
        <label className="language-select-wrap">
          <span>{t("language.label")}</span>
          <select
            className="language-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {supportedLanguages.map((langCode) => (
              <option key={langCode} value={langCode}>
                {t(`language.${langCode}`)}
              </option>
            ))}
          </select>
        </label>
        {isAuthenticated ? (
          <>
            <span className="user-pill">{user?.username}</span>
            {!isAdmin ? <Link to="/profile">{t("header.profile")}</Link> : null}
            {isAdmin ? <Link to="/admin">{t("header.admin")}</Link> : null}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              {t("header.logout")}
            </button>
          </>
        ) : (
          <>
            <Link to="/login">{t("header.login")}</Link>
            <Link to="/register">{t("header.register")}</Link>
          </>
        )}
      </nav>
    </header>
  );
}
