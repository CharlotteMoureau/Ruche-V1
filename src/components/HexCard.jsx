import { useEffect, useRef, useState } from "react";

function getCardIconSources(cardId) {
  const id = String(cardId ?? "").trim();
  if (!id) {
    return [];
  }

  const candidates = [`/icons/${id}.png`];
  const encoded = `/icons/${encodeURIComponent(id)}.png`;
  if (!candidates.includes(encoded)) {
    candidates.push(encoded);
  }

  if (id.endsWith(".")) {
    const withoutTrailingDot = `/icons/${id.slice(0, -1)}.png`;
    if (!candidates.includes(withoutTrailingDot)) {
      candidates.push(withoutTrailingDot);
    }
  }

  return candidates;
}

export default function HexCard({ card, position, onlyFront }) {
  const backContentRef = useRef(null);
  const touchScrollStateRef = useRef(null);
  const [needsScroll, setNeedsScroll] = useState(false);
  const [iconSourceIndex, setIconSourceIndex] = useState(0);

  const style = position
    ? { position: "absolute", left: position.x, top: position.y }
    : {};

  useEffect(() => {
    if (!card || onlyFront) return;

    const contentElement = backContentRef.current;
    if (!contentElement) return;

    const checkOverflow = () => {
      setNeedsScroll(
        contentElement.scrollHeight > contentElement.clientHeight + 1,
      );
    };

    checkOverflow();
    const rafId = window.requestAnimationFrame(checkOverflow);

    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(checkOverflow);
      resizeObserver.observe(contentElement);
    }

    window.addEventListener("resize", checkOverflow);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", checkOverflow);
    };
  }, [card, card?.definition, onlyFront]);

  useEffect(() => {
    setIconSourceIndex(0);
  }, [card?.id]);

  if (!card) return null;

  let extraClass = "";
  if (card.category === "recommandations-enseignant") {
    extraClass = "reco-enseignant";
  } else if (card.category === "recommandations-equipe") {
    extraClass = "reco-equipe";
  }

  const clipId = `hc-${card.id}`;
  const iconSources = getCardIconSources(card.id);
  const iconSource = iconSources[iconSourceIndex] || iconSources[0] || "";

  const handleBackContentTouchStart = (event) => {
    if (!needsScroll || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const contentElement = backContentRef.current;
    if (!contentElement) return;

    touchScrollStateRef.current = {
      startY: touch.clientY,
      startScrollTop: contentElement.scrollTop,
    };

    event.stopPropagation();
  };

  const handleBackContentTouchMove = (event) => {
    if (!needsScroll || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const contentElement = backContentRef.current;
    const touchScrollState = touchScrollStateRef.current;
    if (!contentElement || !touchScrollState) return;

    const deltaY = touch.clientY - touchScrollState.startY;
    contentElement.scrollTop = touchScrollState.startScrollTop - deltaY;

    event.preventDefault();
    event.stopPropagation();
  };

  const handleBackContentTouchEnd = (event) => {
    if (!needsScroll) return;

    touchScrollStateRef.current = null;
    event.stopPropagation();
  };

  return (
    <div className={`hex-card ${card.category}`} style={style}>
      <svg
        className={`hex ${extraClass}`}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
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
          clipPath={`url(#${clipId})`}
        >
          <div className="hex-inner">
            <div className="hex-front">
              <span>{card.id}</span>
              <h4>{card.title}</h4>
              <img
                src={iconSource}
                alt={card.title}
                onError={() => {
                  setIconSourceIndex((current) => {
                    const next = current + 1;
                    return next < iconSources.length ? next : current;
                  });
                }}
              />
            </div>
            {!onlyFront && (
              <div className="hex-back">
                <div
                  ref={backContentRef}
                  className={`hex-back-content ${needsScroll ? "scrollable-back" : ""}`}
                  onTouchStart={handleBackContentTouchStart}
                  onTouchMove={handleBackContentTouchMove}
                  onTouchEnd={handleBackContentTouchEnd}
                  onTouchCancel={handleBackContentTouchEnd}
                >
                  <p className={needsScroll ? "long-def" : ""}>
                    {card.definition}
                  </p>
                </div>
              </div>
            )}
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}
