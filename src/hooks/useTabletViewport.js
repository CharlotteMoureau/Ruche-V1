import { useEffect, useState } from "react";

const TABLET_LANDSCAPE_QUERY =
  "(min-width: 768px) and (max-width: 1200px) and (orientation: landscape) and (pointer: coarse)";
const TABLET_PORTRAIT_QUERY =
  "(min-width: 768px) and (max-width: 1200px) and (orientation: portrait) and (pointer: coarse)";
const PHONE_QUERY = "(max-width: 767px) and (pointer: coarse)";

function getViewportState() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return {
      isTabletLandscape: false,
      isTabletPortrait: false,
      isPhone: false,
    };
  }

  return {
    isTabletLandscape: window.matchMedia(TABLET_LANDSCAPE_QUERY).matches,
    isTabletPortrait: window.matchMedia(TABLET_PORTRAIT_QUERY).matches,
    isPhone: window.matchMedia(PHONE_QUERY).matches,
  };
}

export function useTabletViewport() {
  const [viewport, setViewport] = useState(getViewportState);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQueries = [
      window.matchMedia(TABLET_LANDSCAPE_QUERY),
      window.matchMedia(TABLET_PORTRAIT_QUERY),
      window.matchMedia(PHONE_QUERY),
    ];

    const updateViewport = () => {
      setViewport(getViewportState());
    };

    updateViewport();
    mediaQueries.forEach((query) => {
      query.addEventListener("change", updateViewport);
    });

    return () => {
      mediaQueries.forEach((query) => {
        query.removeEventListener("change", updateViewport);
      });
    };
  }, []);

  return viewport;
}
