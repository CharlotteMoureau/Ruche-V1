import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faUser,
  faCaretDown,
  faArrowLeft,
  faPen,
  faFloppyDisk,
  faArrowsRotate,
  faDownload,
  faUserPlus,
  faComments,
  faEnvelope,
  faGear,
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
  const [isHiveMenuOpen, setIsHiveMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    if (!isHiveMenuOpen && !isProfileMenuOpen) return;
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setIsHiveMenuOpen(false);
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [isHiveMenuOpen, isProfileMenuOpen]);

  const isEditorRoute =
    location.pathname === "/hives/new" ||
    location.pathname.startsWith("/hives/");
  const useTabletEditorHeader =
    isAuthenticated && isEditorRoute && isTabletLandscape;
  const shouldGuardHeaderNavigation = () =>
    isEditorRoute && Boolean(window.__RUCHE_EDITOR_IS_DIRTY);
  const profileBadgeCount = useMemo(() => {
    if (!isAdmin && pendingInvitesCount > 0) return pendingInvitesCount;
    return 0;
  }, [isAdmin, pendingInvitesCount]);

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
    } catch {
      setPendingInvitesCount(0);
    }
  }, [isAuthenticated, isAdmin, token]);

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
    setIsHiveMenuOpen(false);
    setIsProfileMenuOpen(false);
  }, [useTabletEditorHeader]);

  const dispatchEditorAction = (type) => {
    window.dispatchEvent(
      new CustomEvent("ruche:editor-header-action", {
        detail: { type },
      }),
    );
  };

  return (
    <header className="site-header">
      <Link to="/" className="brand-link">
        <img src="/hexagone.png" alt="hexagone" />
        <h1>La Ruche</h1>
        <img src="/abeille.png" alt="abeille" />
      </Link>

      <nav className="site-nav" ref={navRef}>
        {isAuthenticated ? (
          useTabletEditorHeader ? (
            <>
              {!isAdmin ? (
                <div className="header-dropdown-wrap">
                  <button
                    type="button"
                    className="header-dropdown-toggle"
                    onClick={() => {
                      setIsHiveMenuOpen((open) => !open);
                      setIsProfileMenuOpen(false);
                    }}
                  >
                    <FontAwesomeIcon icon={faBars} />
                    <span>{t("header.hiveMenu")}</span>
                    <FontAwesomeIcon icon={faCaretDown} />
                  </button>
                  {isHiveMenuOpen ? (
                    <div className="header-dropdown-menu">
                      <button
                        type="button"
                        onClick={() => {
                          dispatchEditorAction("back-profile");
                          setIsHiveMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        {t("editor.backToProfile")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dispatchEditorAction("edit-title");
                          setIsHiveMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faPen} />
                        {t("editor.hiveTitleLabel")}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(editorHeaderState?.isSaving)}
                        onClick={() => {
                          dispatchEditorAction("save");
                          setIsHiveMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faFloppyDisk} />
                        {editorHeaderState?.isSaving
                          ? t("editor.saving")
                          : t("editor.saveHive")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dispatchEditorAction("reset");
                          setIsHiveMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faArrowsRotate} />
                        {t("toolbar.reset")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dispatchEditorAction("export");
                          setIsHiveMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faDownload} />
                        {t("toolbar.export")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dispatchEditorAction("collaborators");
                          setIsHiveMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faUserPlus} />
                        {t("toolbar.collaborators")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          dispatchEditorAction("comments");
                          setIsHiveMenuOpen(false);
                        }}
                      >
                        <FontAwesomeIcon icon={faComments} />
                        {t("toolbar.comments")}
                        {Number(editorHeaderState?.commentCount || 0) > 0 ? (
                          <span className="inbox-badge">
                            {editorHeaderState.commentCount}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="header-dropdown-wrap">
                <button
                  type="button"
                  className="header-dropdown-toggle"
                  onClick={() => {
                    setIsProfileMenuOpen((open) => !open);
                    setIsHiveMenuOpen(false);
                  }}
                >
                  <FontAwesomeIcon icon={faUser} />
                  <span>{t("header.accountMenu")}</span>
                  <FontAwesomeIcon icon={faCaretDown} />
                  {profileBadgeCount > 0 ? (
                    <span className="inbox-badge">{profileBadgeCount}</span>
                  ) : null}
                </button>
                {isProfileMenuOpen ? (
                  <div className="header-dropdown-menu">
                    {!isAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
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
                    ) : null}
                    {!isAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
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
                    ) : null}
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          navigate("/admin");
                        }}
                      >
                        <FontAwesomeIcon icon={faGear} />
                        {t("header.admin")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
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
                  </div>
                ) : null}
              </div>
            </>
          ) : (
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
          )
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
