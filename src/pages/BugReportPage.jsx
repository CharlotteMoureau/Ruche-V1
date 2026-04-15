import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { fetchPublicAppConfig } from "../lib/api";

export default function BugReportPage() {
  const { t } = useLanguage();
  const [reportEmail, setReportEmail] = useState("");
  const [isLoadingEmail, setIsLoadingEmail] = useState(true);
  const [emailLoadFailed, setEmailLoadFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetchPublicAppConfig()
      .then((config) => {
        if (!isMounted) {
          return;
        }
        setReportEmail(String(config?.supportEmail || "").trim());
        setEmailLoadFailed(false);
        setIsLoadingEmail(false);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setReportEmail("");
        setEmailLoadFailed(true);
        setIsLoadingEmail(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  const mailtoHref = reportEmail
    ? `mailto:${reportEmail}?subject=${encodeURIComponent(
        t("bugReportPage.emailSubject"),
      )}&body=${encodeURIComponent(t("bugReportPage.emailTemplate"))}`
    : null;

  return (
    <section className="page-shell bug-report-page">
      <h2>{t("bugReportPage.title")}</h2>
      <p className="bug-report-intro">{t("bugReportPage.intro")}</p>

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
        {isLoadingEmail ? (
          <p className="bug-report-note">{t("bugReportPage.emailLoading")}</p>
        ) : mailtoHref ? (
          <a href={mailtoHref} className="bug-report-mail-button">
            {t("bugReportPage.sendButton")}
          </a>
        ) : emailLoadFailed ? (
          <p className="bug-report-note">{t("bugReportPage.emailLoadFailed")}</p>
        ) : (
          <p className="bug-report-note">{t("bugReportPage.emailUnavailable")}</p>
        )}
        {!isLoadingEmail && mailtoHref ? (
          <p className="bug-report-note">{t("bugReportPage.emailNote")}</p>
        ) : null}
      </div>

      <Link to="/" className="bug-report-back-link">
        ← {t("wipPage.back")}
      </Link>
    </section>
  );
}