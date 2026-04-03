import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { HIVE_KINDS, isDcoRole } from "../lib/hives";
import UnifiedPromptModal from "../components/UnifiedPromptModal";

export default function LandingPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [selectingHiveType, setSelectingHiveType] = useState(false);
  const [selectedHiveKind, setSelectedHiveKind] = useState(null);
  const [creatingHive, setCreatingHive] = useState(false);
  const [newHiveTitle, setNewHiveTitle] = useState("");

  const isDcoUser = isDcoRole(user?.roleLabel);

  const handleCreateHiveClick = () => {
    if (isDcoUser) {
      setSelectingHiveType(true);
    } else {
      setCreatingHive(true);
    }
  };

  const confirmHiveType = (kind) => {
    setSelectedHiveKind(kind);
    setSelectingHiveType(false);
    setCreatingHive(true);
  };

  const closeCreateHiveModal = () => {
    setCreatingHive(false);
    setNewHiveTitle("");
    setSelectedHiveKind(null);
  };

  const confirmCreateHive = () => {
    const trimmedTitle = newHiveTitle.trim();
    if (!trimmedTitle) return;

    const hiveKind = isDcoUser
      ? selectedHiveKind || HIVE_KINDS.STANDARD
      : HIVE_KINDS.STANDARD;

    navigate("/hives/new", {
      state: { title: trimmedTitle, hiveKind },
    });
    closeCreateHiveModal();
  };

  if (isLoading) {
    return (
      <section className="page-shell">
        <h2>{t("landing.title")}</h2>
        <p>{t("landing.loading")}</p>
      </section>
    );
  }

  return (
    <>
      <section className="page-shell">
        <h2>{t("landing.title")}</h2>
        <p>{isAuthenticated ? t("landing.connected") : t("landing.guest")}</p>
        <div className="cta-grid landing-cta-grid">
          {isAuthenticated ? (
            <>
              <Link to="/profile" className="cta-card">
                <div className="cta-card-image">
                  <img src="/Profile.jpg" alt="Profile" />
                </div>
                <div className="cta-card-content">{t("landing.goProfile")}</div>
              </Link>
              <div
                onClick={handleCreateHiveClick}
                role="button"
                tabIndex={0}
                className="cta-card cta-card-interactive"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleCreateHiveClick();
                  }
                }}
              >
                <div className="cta-card-image">
                  <img src="/Hive.jpg" alt="Create Hive" />
                </div>
                <div className="cta-card-content">
                  {t("landing.createHive")}
                </div>
              </div>
              <a
                href="https://www.peca.be/ressources/boite-a-outils/la-ruche"
                target="_blank"
                rel="noopener noreferrer"
                className="cta-card"
              >
                <div className="cta-card-image">
                  <img src="/Learn%20more.jpg" alt="Learn More" />
                </div>
                <div className="cta-card-content">{t("landing.learnMore")}</div>
              </a>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="cta-card cta-card-auth cta-card-auth-signin"
              >
                <div className="cta-card-content cta-card-auth-content">
                  <h3>{t("landing.signIn")}</h3>
                  <p>{t("landing.connected")}</p>
                </div>
              </Link>
              <Link
                to="/register"
                className="cta-card cta-card-auth cta-card-auth-register"
              >
                <div className="cta-card-content cta-card-auth-content">
                  <h3>{t("landing.createAccount")}</h3>
                  <p>{t("landing.guest")}</p>
                </div>
              </Link>
            </>
          )}
        </div>

        <a
          href=""
          target="_blank"
          rel="noopener noreferrer"
          className="landing-tutorial cta-card"
        >
          <div className="cta-card-content landing-tutorial-content">
            <h3>{t("landing.tutorial")}</h3>
            <p>{t("landing.tutorialPlaceholder")}</p>
          </div>
        </a>
      </section>

      <section className="page-shell">
        <section className="landing-footer-info">
          <div className="landing-gdpr">
            <h4>{t("landing.gdpr")}</h4>
            <p>{t("landing.gdprPlaceholder")}</p>
          </div>
          <div className="landing-wip">
            <h4>{t("landing.wip")}</h4>
            <p>{t("landing.wipPlaceholder")}</p>
          </div>
        </section>
      </section>

      <UnifiedPromptModal
        isOpen={selectingHiveType}
        mode="confirm"
        title={t("profile.modalselectHiveTypeTitle")}
        message={t("profile.selectHiveTypeMessage")}
        confirmLabel={t("profile.selectStandardHive")}
        extraActionLabel={t("profile.selectDcoHive")}
        onConfirm={() => confirmHiveType(HIVE_KINDS.STANDARD)}
        onExtraAction={() => confirmHiveType(HIVE_KINDS.DCO)}
        onCancel={() => setSelectingHiveType(false)}
      />

      <UnifiedPromptModal
        isOpen={creatingHive}
        mode="prompt"
        title={t("profile.modalCreateTitle")}
        message={t("profile.modalCreateMessage")}
        inputLabel={t("profile.modalCreateInput")}
        inputPlaceholder={t("profile.modalCreatePlaceholder")}
        value={newHiveTitle}
        onValueChange={setNewHiveTitle}
        confirmLabel={t("common.confirm")}
        confirmDisabled={!newHiveTitle.trim()}
        onCancel={closeCreateHiveModal}
        onConfirm={confirmCreateHive}
      />
    </>
  );
}
