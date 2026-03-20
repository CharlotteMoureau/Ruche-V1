const cells = Array.from({ length: 7 }, (_, index) => index + 1);

export default function PageLoader({
  title = "Chargement...",
  subtitle = "Un instant, nous preparons votre espace.",
  variant = "default",
}) {
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
      <p className="page-loader__title">{title}</p>
      <p className="page-loader__subtitle">{subtitle}</p>
    </div>
  );
}
