import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { apiFetch } from "../lib/api";

export default function AppHeader() {
  const { isAuthenticated, logout, isAdmin, token } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  const isEditorRoute =
    location.pathname === "/hives/new" ||
    location.pathname.startsWith("/hives/");
  const shouldGuardHeaderNavigation = () =>
    isEditorRoute && Boolean(window.__RUCHE_EDITOR_IS_DIRTY);

  const requestEditorLeave = (request) => {
    window.dispatchEvent(
      new CustomEvent("ruche:request-editor-leave", {
        detail: request,
      }),
    );
  };

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
        {isAuthenticated ? (
          <>
            {!isAdmin ? (
              <Link
                to="/profile"
                className={`header-nav-link${location.pathname === "/profile" ? " is-active" : ""}`}
                onClick={(event) => {
                  if (!shouldGuardHeaderNavigation()) return;
                  event.preventDefault();
                  requestEditorLeave({ type: "route", to: "/profile" });
                }}
              >
                {t("header.profile")}
              </Link>
            ) : null}
            {!isAdmin ? (
              <Link
                to="/inbox"
                className={`header-nav-link inbox-link${location.pathname === "/inbox" ? " is-active" : ""}`}
                onClick={(event) => {
                  if (!shouldGuardHeaderNavigation()) return;
                  event.preventDefault();
                  requestEditorLeave({ type: "route", to: "/inbox" });
                }}
              >
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
                if (shouldGuardHeaderNavigation()) {
                  requestEditorLeave({ type: "logout" });
                  return;
                }
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
