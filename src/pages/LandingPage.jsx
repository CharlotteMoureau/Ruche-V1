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
              {t("landing.goProfile")}
            </Link>
            <Link to="/hives/new" className="cta-card">
              {t("landing.createHive")}
            </Link>
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
