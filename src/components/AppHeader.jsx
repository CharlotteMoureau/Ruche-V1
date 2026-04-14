import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faUser,
  faHouse,
  faPen,
  faFloppyDisk,
  faArrowsRotate,
  faDownload,
  faUserPlus,
  faComments,
  faEnvelope,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { apiFetch } from "../lib/api";
import { useTabletViewport } from "../hooks/useTabletViewport";

export default function AppHeader() {
  const { isAuthenticated, logout, isAdmin, token } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabletLandscape } = useTabletViewport();
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [editorHeaderState, setEditorHeaderState] = useState(null);
  const [isTabletMenuOpen, setIsTabletMenuOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    if (!isTabletMenuOpen) return;
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setIsTabletMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [isTabletMenuOpen]);

  const isEditorRoute =
    location.pathname === "/hives/new" ||
    location.pathname.startsWith("/hives/");
  const useTabletEditorHeader =
    isAuthenticated && isEditorRoute && isTabletLandscape;
  const shouldGuardHeaderNavigation = () =>
    isEditorRoute && Boolean(window.__RUCHE_EDITOR_IS_DIRTY);

  const requestEditorLeave = (request) => {
    window.dispatchEvent(
      new CustomEvent("ruche:request-editor-leave", {
        detail: request,
      }),
    );
  };

  const refreshPendingInvitesCount = useCallback(async () => {
    if (!isAuthenticated || isAdmin || !token) {
      setPendingInvitesCount(0);
      return;
    }

    try {
      const data = await apiFetch("/hives/invitations/count", { token });
      setPendingInvitesCount(Number(data?.count || 0));
    } catch (error) {
      if (error?.status === 401) {
        setPendingInvitesCount(0);
        logout();
        return;
      }
      setPendingInvitesCount(0);
    }
  }, [isAuthenticated, isAdmin, logout, token]);

  useEffect(() => {
    if (!isAuthenticated || isAdmin || !token) {
      setPendingInvitesCount(0);
      return;
    }

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "hidden") return;
      refreshPendingInvitesCount();
    };

    const handleManualRefresh = () => {
      refreshPendingInvitesCount();
    };

    refreshPendingInvitesCount();
    const intervalId = window.setInterval(refreshPendingInvitesCount, 5000);
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("ruche:invitations-updated", handleManualRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener(
        "ruche:invitations-updated",
        handleManualRefresh,
      );
    };
  }, [isAuthenticated, isAdmin, refreshPendingInvitesCount, token]);

  useEffect(() => {
    const handleEditorHeaderState = (event) => {
      setEditorHeaderState(event.detail || null);
    };

    window.addEventListener(
      "ruche:editor-header-state",
      handleEditorHeaderState,
    );

    return () => {
      window.removeEventListener(
        "ruche:editor-header-state",
        handleEditorHeaderState,
      );
    };
  }, []);

  useEffect(() => {
    if (useTabletEditorHeader) return;
    setIsTabletMenuOpen(false);
  }, [useTabletEditorHeader]);

  const dispatchEditorAction = (type) => {
    window.dispatchEvent(
      new CustomEvent("ruche:editor-header-action", {
        detail: { type },
      }),
    );
  };

  const brandTarget = isAuthenticated && isAdmin ? "/admin" : "/";
  const canUseTabletSaveButton = Boolean(editorHeaderState?.canReset);

  return (
    <header
      className={`site-header${useTabletEditorHeader ? " site-header--tablet-editor" : ""}`}
    >
      {useTabletEditorHeader ? (
        <>
          <div className="site-header__tablet-leading">
            <nav className="site-nav site-nav--tablet-editor" ref={navRef}>
              <div className="header-dropdown-wrap">
                <button
                  type="button"
                  className="header-dropdown-toggle header-dropdown-toggle--icon"
                  aria-label={t("header.hiveMenu")}
                  onClick={() => {
                    setIsTabletMenuOpen((open) => !open);
                  }}
                >
                  <FontAwesomeIcon icon={faBars} />
                </button>
                {isTabletMenuOpen ? (
                  <div className="header-dropdown-menu header-dropdown-menu--tablet">
                    <section className="header-tablet-menu-section">
                      <p className="header-tablet-menu-title">
                        {t("header.hiveMenu")}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          dispatchEditorAction("back-profile");
                          setIsTabletMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faHouse} />
                        {t("editor.backToProfile")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dispatchEditorAction("edit-title");
                          setIsTabletMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faPen} />
                        {t("editor.hiveTitleLabel")}
                      </button>
                      {editorHeaderState?.canReset ? (
                        <button
                          type="button"
                          onClick={() => {
                            dispatchEditorAction("reset");
                            setIsTabletMenuOpen(false);
                          }}
                        >
                          <FontAwesomeIcon icon={faArrowsRotate} />
                          {t("toolbar.reset")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          dispatchEditorAction("export");
                          setIsTabletMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faDownload} />
                        {t("toolbar.export")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dispatchEditorAction("collaborators");
                          setIsTabletMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faUserPlus} />
                        {t("toolbar.collaborators")}
                      </button>
                    </section>

                    <section className="header-tablet-menu-section">
                      <p className="header-tablet-menu-title">
                        {t("header.accountMenu")}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTabletMenuOpen(false);
                          if (shouldGuardHeaderNavigation()) {
                            requestEditorLeave({
                              type: "route",
                              to: "/profile",
                            });
                            return;
                          }
                          navigate("/profile");
                        }}
                      >
                        <FontAwesomeIcon icon={faUser} />
                        {t("header.profile")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTabletMenuOpen(false);
                          if (shouldGuardHeaderNavigation()) {
                            requestEditorLeave({ type: "route", to: "/inbox" });
                            return;
                          }
                          navigate("/inbox");
                        }}
                      >
                        <FontAwesomeIcon icon={faEnvelope} />
                        {t("header.inbox")}
                        {pendingInvitesCount > 0 ? (
                          <span className="inbox-badge">
                            {pendingInvitesCount}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTabletMenuOpen(false);
                          if (shouldGuardHeaderNavigation()) {
                            requestEditorLeave({ type: "logout" });
                            return;
                          }
                          logout();
                          navigate("/");
                        }}
                      >
                        <FontAwesomeIcon icon={faRightFromBracket} />
                        {t("header.logout")}
                      </button>
                    </section>
                  </div>
                ) : null}
              </div>
            </nav>

            <Link to={brandTarget} className="brand-link">
              <img src="/hexagone.png" alt="hexagone" />
              <h1>La Ruche</h1>
              <img src="/abeille.png" alt="abeille" />
            </Link>
          </div>

          {canUseTabletSaveButton ? (
            <>
              <button
                type="button"
                className="header-save-btn"
                disabled={Boolean(editorHeaderState?.isSaving)}
                onClick={() => dispatchEditorAction("save")}
              >
                <FontAwesomeIcon icon={faFloppyDisk} />
                {editorHeaderState?.isSaving
                  ? t("editor.saving")
                  : t("editor.saveHive")}
              </button>
              <button
                type="button"
                className="header-comments-btn"
                onClick={() => dispatchEditorAction("comments")}
                aria-label={t("toolbar.comments")}
              >
                <FontAwesomeIcon icon={faComments} />
                {Number(editorHeaderState?.commentCount || 0) > 0 ? (
                  <span className="inbox-badge">
                    {editorHeaderState.commentCount}
                  </span>
                ) : null}
              </button>
            </>
          ) : null}
        </>
      ) : (
        <>
          <Link to={brandTarget} className="brand-link">
            <img src="/hexagone.png" alt="hexagone" />
            <h1>La Ruche</h1>
            <img src="/abeille.png" alt="abeille" />
          </Link>

          <nav className="site-nav" ref={navRef}>
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
                    <FontAwesomeIcon icon={faUser} />
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
                    <FontAwesomeIcon icon={faEnvelope} />
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
                  <FontAwesomeIcon icon={faRightFromBracket} />
                  {t("header.logout")}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`header-nav-link${location.pathname === "/login" ? " is-active" : ""}`}
                >
                  {t("header.login")}
                </Link>
                <Link
                  to="/register"
                  className={`header-nav-link${location.pathname === "/register" ? " is-active" : ""}`}
                >
                  {t("header.register")}
                </Link>
              </>
            )}
          </nav>
        </>
      )}
    </header>
  );
}
