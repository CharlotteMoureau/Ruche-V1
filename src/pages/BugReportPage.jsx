import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

const REPORT_EMAIL = "laruche.support@cfwb.be";

export default function BugReportPage() {
  const { t } = useLanguage();

  const sections = [
    {
      titleKey: "bugReportPage.section1Title",
      bodyKey: "bugReportPage.section1",
    },
    {
      titleKey: "bugReportPage.section2Title",
      bodyKey: "bugReportPage.section2",
    },
    {
      titleKey: "bugReportPage.section3Title",
      bodyKey: "bugReportPage.section3",
    },
    {
      titleKey: "bugReportPage.section4Title",
      bodyKey: "bugReportPage.section4",
    },
  ];

  const tips = [
    t("bugReportPage.tip1"),
    t("bugReportPage.tip2"),
    t("bugReportPage.tip3"),
  ];

  const mailtoHref = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(
    t("bugReportPage.emailSubject"),
  )}&body=${encodeURIComponent(t("bugReportPage.emailTemplate"))}`;

  return (
    <section className="page-shell bug-report-page">
      <h2>{t("bugReportPage.title")}</h2>
      <p className="bug-report-intro">{t("bugReportPage.intro")}</p>
      <p className="bug-report-context">{t("bugReportPage.context")}</p>

      <div className="bug-report-sections">
        {sections.map(({ titleKey, bodyKey }) => (
          <div key={titleKey} className="bug-report-section">
            <h3>{t(titleKey)}</h3>
            <p>{t(bodyKey)}</p>
          </div>
        ))}
      </div>

      <div className="bug-report-tips">
        <h3>{t("bugReportPage.tipsTitle")}</h3>
        <ul>
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>

      <div className="bug-report-actions">
        <a href={mailtoHref} className="bug-report-mail-button">
          {t("bugReportPage.sendButton")}
        </a>
        <p className="bug-report-note">{t("bugReportPage.emailNote")}</p>
      </div>

      <Link to="/" className="bug-report-back-link">
        ← {t("wipPage.back")}
      </Link>
    </section>
  );
}