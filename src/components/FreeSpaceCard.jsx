export default function FreeHexCard({ card }) {
  const text = card.title || "+";

  return (
    <svg
      className={`free-space-card`}
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
        <div className="free-hex-inner">
          <div className="free-hex-front">
            <h4>{text}</h4>
            <img
              className="free-img"
              src={`./data/icons/free.png`}
              alt={text}
            />
          </div>
        </div>
      </foreignObject>
    </svg>
  );
}
