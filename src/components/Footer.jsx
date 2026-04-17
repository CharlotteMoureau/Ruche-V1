import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export default function Footer() {
  const { language, setLanguage, supportedLanguages, t } = useLanguage();

  return (
    <footer>
      <div className="administration">
        <a
          href="https://www.peca.be/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/logos officiels/peca.svg" alt="PECA logo" />
        </a>
        <a
          href="https://www.federation-wallonie-bruxelles.be/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/logos officiels/fwb.png" alt="logo FW-B" />
        </a>
        <a
          href="https://pactepourunenseignementdexcellence.cfwb.be/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/logos officiels/pacte.png"
            alt="logo Pacte pour un Enseignement d'excellence"
          />
        </a>
      </div>
      <div className="footer-center">
        <div className="footer-legal">
          <Link to="/gdpr">{t("landing.gdpr")}</Link>
          <span aria-hidden="true">·</span>
          <Link to="https://www.peca.be/contact" target="_blank">
            {t("landing.contact")}
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/report-bug">{t("landing.reportBug")}</Link>
          <span aria-hidden="true">·</span>
          <Link to="/wip">{t("landing.wip")}</Link>
        </div>
        <label className="language-select-wrap">
          <span>{t("language.label")}</span>
          <select
            id="language-select"
            className="language-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {supportedLanguages.map((langCode) => (
              <option key={langCode} value={langCode}>
                {t(`language.${langCode}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="unif">
        <a
          href="https://web.umons.ac.be/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/logos officiels/umons.png" alt="logo UMons" />
        </a>
        <a
          href="https://www.unamur.be/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/logos officiels/unamur.svg" alt="logo UNamur" />
        </a>
        <a
          href="https://www.uliege.be/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/logos officiels/uliège.png" alt="logo ULiège" />
        </a>
      </div>
    </footer>
  );
}
