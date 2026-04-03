import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export default function GdprPage() {
  const { t, language } = useLanguage();

  const gdprLawUrl = `https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=${language}`;

  return (
    <section className="page-shell gdpr-page">
      <h2>{t("gdprPage.title")}</h2>
      <p className="gdpr-intro">{t("gdprPage.intro")}</p>

      <div className="gdpr-sections">
        <div className="gdpr-section">
          <h3>{t("gdprPage.section1Title")}</h3>
          <p>{t("gdprPage.section1")}</p>
        </div>

        <div className="gdpr-section">
          <h3>{t("gdprPage.section2Title")}</h3>
          <p>{t("gdprPage.section2")}</p>
        </div>

        <div className="gdpr-section">
          <h3>{t("gdprPage.section3Title")}</h3>
          <p>{t("gdprPage.section3")}</p>
        </div>

        <div className="gdpr-section">
          <h3>{t("gdprPage.section4Title")}</h3>
          <p>{t("gdprPage.section4")}</p>
        </div>

        <div className="gdpr-section">
          <h3>{t("gdprPage.section5Title")}</h3>
          <p>
            {t("gdprPage.section5a")}
            <a href={gdprLawUrl} target="_blank" rel="noopener noreferrer">
              {t("gdprPage.section5Link")}
            </a>
            {t("gdprPage.section5b")}
          </p>
        </div>

        <div className="gdpr-section">
          <h3>{t("gdprPage.section6Title")}</h3>
          <p>{t("gdprPage.section6")}</p>
        </div>
      </div>

      <p className="gdpr-contact">
        {t("gdprPage.contact")}{" "}
        <a
          href="https://www.peca.be/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("gdprPage.contactLinkLabel")}
        </a>
        .
      </p>

      <Link to="/" className="gdpr-back-link">
        ← {t("wipPage.back")}
      </Link>
    </section>
  );
}
