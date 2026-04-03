import { useLanguage } from "../context/LanguageContext";
import ReactMarkdown from "react-markdown";
import manualEn from "../data/manual-en.js";
import manualFr from "../data/manual-fr.js";
import manualNl from "../data/manual-nl.js";

export default function TutorialPage() {
  const { t, language } = useLanguage();

  const manuals = {
    en: manualEn,
    fr: manualFr,
    nl: manualNl,
  };

  const currentManual = manuals[language] || manualEn;

  return (
    <section className="page-shell tutorial-page">
      <h2>{t("tutorial.title")}</h2>

      <div className="tutorial-video-container">
        <iframe
          width="100%"
          height="600"
          src="https://www.youtube.com/embed/WI2ICPIcDiY"
          title="La Ruche Tutorial"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>

      <div className="tutorial-content markdown-content">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h2>{children}</h2>,
            h2: ({ children }) => <h3>{children}</h3>,
            h3: ({ children }) => <h4>{children}</h4>,
            h4: ({ children }) => <h5>{children}</h5>,
            h5: ({ children }) => <h6>{children}</h6>,
          }}
        >
          {String(currentManual)}
        </ReactMarkdown>
      </div>
    </section>
  );
}
