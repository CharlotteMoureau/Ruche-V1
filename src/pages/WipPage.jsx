import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

const WIP_CTA_URL = "https://la-ruche.netlify.app/";

export default function WipPage() {
  const { t } = useLanguage();

  const versions = [
    {
      titleKey: "wipPage.v1Title",
      bodyKey: "wipPage.v1Body",
      badge: "V1",
      ctaKey: "wipPage.cta",
      href: WIP_CTA_URL,
    },
    {
      titleKey: "wipPage.v2Title",
      bodyKey: "wipPage.v2Body",
      badge: "V2",
    },
  ];

  const features = [
    {
      titleKey: "wipPage.feature1Title",
      bodyKey: "wipPage.feature1",
      icon: "🔄",
      showStatus: true,
    },
    {
      titleKey: "wipPage.feature3Title",
      bodyKey: "wipPage.feature3",
      icon: "💬",
      showStatus: true,
    },
  ];

  return (
    <section className="page-shell wip-page">
      <h2>{t("wipPage.title")}</h2>
      <p className="wip-intro">{t("wipPage.intro")}</p>

      <h3 className="wip-section-heading">{t("wipPage.historyTitle")}</h3>
      <div className="wip-history">
        {versions.map(({ titleKey, bodyKey, badge, ctaKey, href }) => (
          <div key={titleKey} className="wip-version-card">
            <div className="wip-version-badge">{badge}</div>
            <div className="wip-feature-body">
              <h4>{t(titleKey)}</h4>
              <p>{t(bodyKey)}</p>
              {ctaKey && href ? (
                <a
                  href={href}
                  className="button-link button-link-open wip-version-link"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t(ctaKey)}
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <h3 className="wip-section-heading">{t("wipPage.upcomingTitle")}</h3>
      <div className="wip-features">
        {features.map(({ titleKey, bodyKey, icon, showStatus }) => (
          <div key={titleKey} className="wip-feature-card">
            <div className="wip-feature-icon">{icon}</div>
            <div className="wip-feature-body">
              <h4>{t(titleKey)}</h4>
              <p>{t(bodyKey)}</p>
              {showStatus ? (
                <span className="wip-status">{t("wipPage.status")}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <Link to="/" className="wip-back-link">
        ← {t("wipPage.back")}
      </Link>
    </section>
  );
}
