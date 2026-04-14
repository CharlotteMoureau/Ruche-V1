import { FREE_CARD_ICON_PATH } from "../lib/freeCardIcon";

export default function FreeHexCard({ card }) {
	const text = card.title || "";

	const svg = (
		<svg
			className="icon"
			version="1.1"
			id="Layer_1"
			xmlns="http://www.w3.org/2000/svg"
			xmlnsXlink="http://www.w3.org/1999/xlink"
			x="0px"
			y="0px"
			width="100%"
			viewBox="0 0 512 512"
			enableBackground="new 0 0 512 512"
			xmlSpace="preserve"
			key="svg"
		>
			<path
				id="vert"
				fill="currentColor"
				opacity="1.000000"
				stroke="none"
				d={FREE_CARD_ICON_PATH}
			/>
		</svg>
	);

	const clipId = `fsc-${card.id}`;

	return (
		<svg
			className={`free-space-card${card.color && card.color !== "lime" ? ` free-card--${card.color}` : ""}`}
			viewBox="0 0 100 100"
			xmlns="http://www.w3.org/2000/svg"
			style={{ overflow: "visible" }}
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
				style={{ pointerEvents: "none" }}
			>
				<div className="free-hex-inner">
					<div className="free-hex-front">
						<h4>{text}</h4>
						{svg}
					</div>
				</div>
			</foreignObject>
		</svg>
	);
}
