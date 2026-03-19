import { useEffect, useState } from "react";

/**
 * Hook to detect iOS/Safari devices and apply styling to document
 * Runs once on mount using useState to ensure single execution
 */
export function useDeviceDetection() {
  const [deviceInfo] = useState(() => {
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

    return { isIOS, isSafari };
  });

  useEffect(() => {
    const { isIOS, isSafari } = deviceInfo;
    if (isIOS || isSafari) {
      document.body.classList.add("ios");
    }
  }, [deviceInfo]);

  return deviceInfo;
}
