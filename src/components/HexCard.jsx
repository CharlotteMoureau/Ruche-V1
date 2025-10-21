export default function HexCard({ card, position }) {
  const style = position
    ? { position: "absolute", left: position.x, top: position.y }
    : {};

  let extraClass = "";
  if (card.category === "recommandations-enseignant") {
    extraClass = "reco-enseignant";
  } else if (card.category === "recommandations-equipe") {
    extraClass = "reco-equipe";
  }

  return (
    <div className={`hex-card ${card.category}`} style={style}>
      <svg
        className={`hex ${extraClass}`}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="hexClip" clipPathUnits="objectBoundingBox">
            <polygon points="0.5,0 0.93,0.25 0.93,0.75 0.5,1 0.07,0.75 0.07,0.25" />
          </clipPath>
        </defs>

        <polygon
          className="hex-shape"
          points="50,0 93,25 93,75 50,100 7,75 7,25"
        />

        <foreignObject
          x="0"
          y="0"
          width="100"
          height="100"
          clipPath="url(#hexClip)"
        >
          <div className="hex-inner">
            <div className="hex-front">
              <span>{card.id}</span>
              <h4>{card.title}</h4>
              <img src={`./data/icons/${card.id}.png`} alt={card.title} />
            </div>
            <div className="hex-back">
              <p className="hex-back-p">{card.definition}</p>
            </div>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}
