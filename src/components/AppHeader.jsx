import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { apiFetch } from "../lib/api";

export default function AppHeader() {
  const { isAuthenticated, user, logout, isAdmin, token } = useAuth();
  const { language, setLanguage, supportedLanguages, t } = useLanguage();
  const navigate = useNavigate();
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || isAdmin || !token) {
      setPendingInvitesCount(0);
      return;
    }

    let mounted = true;

    const loadCount = async () => {
      try {
        const data = await apiFetch("/hives/invitations/count", { token });
        if (mounted) {
          setPendingInvitesCount(Number(data?.count || 0));
        }
      } catch {
        if (mounted) {
          setPendingInvitesCount(0);
        }
      }
    };

    loadCount();
    const intervalId = window.setInterval(loadCount, 15000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, isAdmin, token]);

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
            id="language-select"
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
            {!isAdmin ? (
              <Link to="/inbox" className="inbox-link">
                {t("header.inbox")}
                {pendingInvitesCount > 0 ? (
                  <span className="inbox-badge">{pendingInvitesCount}</span>
                ) : null}
              </Link>
            ) : null}
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
