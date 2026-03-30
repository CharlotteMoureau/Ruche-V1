import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <section className="page-shell">
        <h2>{t("landing.title")}</h2>
        <p>{t("landing.loading")}</p>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <h2>{t("landing.title")}</h2>
      <p>{isAuthenticated ? t("landing.connected") : t("landing.guest")}</p>
      <div className="cta-grid">
        {isAuthenticated ? (
          <>
            <Link to="/profile" className="cta-card">
              <div className="cta-card-image">
                <img src="https://via.placeholder.com/400x200?text=Your+Profile" alt="Profile" />
              </div>
              <div className="cta-card-content">
                {t("landing.goProfile")}
              </div>
            </Link>
            <Link to="/hives/new" className="cta-card">
              <div className="cta-card-image">
                <img src="https://via.placeholder.com/400x200?text=Create+a+Hive" alt="Create Hive" />
              </div>
              <div className="cta-card-content">
                {t("landing.createHive")}
              </div>
            </Link>
            <a href="https://www.peca.be/ressources/boite-a-outils/la-ruche" target="_blank" rel="noopener noreferrer" className="cta-card">
              <div className="cta-card-image">
                <img src="https://via.placeholder.com/400x200?text=Learn+About+Hive" alt="Learn More" />
              </div>
              <div className="cta-card-content">
                {t("landing.learnMore")}
              </div>
            </a>
          </>
        ) : (
          <>
            <Link to="/login" className="cta-card">
              {t("landing.signIn")}
            </Link>
            <Link to="/register" className="cta-card">
              {t("landing.createAccount")}
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
