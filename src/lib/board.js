export const BOARD_CARD_SIZE = 200;
export const BOARD_CANVAS_WIDTH = 2200;
export const BOARD_CANVAS_HEIGHT = 1600;
export const BOARD_DEFAULT_ZOOM = 1;
export const BOARD_COMPACT_DEFAULT_ZOOM = 0.85;
export const BOARD_MIN_ZOOM = 0.4;
export const BOARD_MAX_ZOOM = 1.2;
export const BOARD_ZOOM_STEP = 0.1;
export const BOARD_NOTE_OFFSET = {
  x: 162,
  y: 10,
};

export function clampBoardZoom(value) {
  return Math.min(BOARD_MAX_ZOOM, Math.max(BOARD_MIN_ZOOM, value));
}

export function clampBoardPosition(position) {
  return {
    x: Math.min(
      BOARD_CANVAS_WIDTH - BOARD_CARD_SIZE,
      Math.max(0, position.x),
    ),
    y: Math.min(
      BOARD_CANVAS_HEIGHT - BOARD_CARD_SIZE,
      Math.max(0, position.y),
    ),
  };
}