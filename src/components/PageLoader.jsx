import { useLanguage } from "../context/LanguageContext";

const cells = Array.from({ length: 7 }, (_, index) => index + 1);

export default function PageLoader({ title, subtitle, variant = "default" }) {
  const { t } = useLanguage();
  const resolvedTitle = title || t("common.loading");
  const resolvedSubtitle = subtitle || t("profile.loadingSubtitle");

  return (
    <div
      className={`page-loader page-loader--${variant}`}
      role="status"
      aria-live="polite"
    >
      <div className="page-loader__halo" aria-hidden="true" />
      <div className="page-loader__honeycomb" aria-hidden="true">
        {cells.map((cell) => (
          <span
            key={cell}
            className="page-loader__cell"
            style={{ "--delay-index": cell }}
          />
        ))}
      </div>
      <p className="page-loader__title">{resolvedTitle}</p>
      <p className="page-loader__subtitle">{resolvedSubtitle}</p>
    </div>
  );
}
