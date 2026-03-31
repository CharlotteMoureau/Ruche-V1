import { useLanguage } from "../context/LanguageContext";

export default function Footer() {
  const { language, setLanguage, supportedLanguages, t } = useLanguage();

  return (
    <footer>
      <div className="administration">
        <a href="https://www.peca.be/" target="_blank">
          <img src="/data/logos/peca.svg" alt="PECA logo" />
        </a>
        <a href="https://www.federation-wallonie-bruxelles.be/" target="_blank">
          <img src="/data/logos/fwb.png" alt="logo FW-B" />
        </a>
        <a
          href="https://pactepourunenseignementdexcellence.cfwb.be/"
          target="_blank"
        >
          <img
            src="/data/logos/pacte.png"
            alt="logo Pacte pour un Enseignement d'excellence"
          />
        </a>
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
      <div className="unif">
        <a href="https://web.umons.ac.be/" target="_blank">
          <img src="/data/logos/umons.png" alt="logo UMons" />
        </a>
        <a href="https://www.unamur.be/" target="_blank">
          <img src="/data/logos/unamur.svg" alt="logo UNamur" />
        </a>
        <a href="https://www.uliege.be/" target="_blank">
          <img src="/data/logos/uliège.png" alt="logo ULiège" />
        </a>
      </div>
    </footer>
  );
}
