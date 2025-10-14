export default function HexCard({ card, position }) {
  const style = position
    ? { position: "absolute", left: position.x, top: position.y }
    : {};

  return (
    <div className={`hex-card ${card.category}`} style={style}>
      <div className={`hex-front`}>
        {card.icon && (
          <img
            src={card.icon}
            alt={card.title}
            style={{ width: 24, height: 24, marginBottom: 4 }}
          />
        )}
        <span>{card.title}</span>
      </div>
      <div className={`hex-back`}>
        <p>{card.definition}</p>
      </div>
    </div>
  );
}
