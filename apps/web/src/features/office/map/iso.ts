/**
 * docs/07 "カイロソフト風・3D": true isometric (2:1 diamond) projection, the same technique
 * Kairosoft's games use - it's 2D all the way down, so PixiJS handles it natively with a linear
 * transform plus painter's-algorithm depth sorting; no 3D engine or extra modules required.
 *
 * World coordinates are floor tiles (floats allowed). +x runs toward screen right-down,
 * +y runs toward screen left-down, so screen depth (draw order) is simply x + y.
 */
export const TILE_W = 44;
export const TILE_H = 22;
/** Back-wall height in screen px. */
export const WALL_H = 36;
/** Height of the low front/side parapet walls (docs/07: rooms read as open boxes, like the reference). */
export const PARAPET_H = 12;
export const GRID_COLS = 27;
export const GRID_ROWS = 19;

/** Wide enough for the 2-tile sidewalk apron + exterior planting drawn around the building. */
const MARGIN_X = 66;
const MARGIN_TOP = WALL_H + 34;

/** How many tiles of grey sidewalk ring the building (docs/07: grounds the diorama like the reference). */
export const APRON_TILES = 2;

/** Screen position of world origin (0,0): pushed right so the grid's leftmost corner (0, GRID_ROWS) fits. */
export const ORIGIN_X = MARGIN_X + GRID_ROWS * (TILE_W / 2);
export const ORIGIN_Y = MARGIN_TOP;

/** 3:2 stage matching the generated architectural background. */
export const OFFICE_WIDTH = 1200;
export const OFFICE_HEIGHT = 800;

export function isoToScreen(wx: number, wy: number): { x: number; y: number } {
  return {
    x: ORIGIN_X + (wx - wy) * (TILE_W / 2),
    y: ORIGIN_Y + (wx + wy) * (TILE_H / 2),
  };
}

/**
 * Projects the existing 27x19 navigation grid onto the visible floor quadrilateral in the
 * high-resolution architectural background. This keeps A* movement and area assignments intact
 * while allowing the visual layer to use a more top-down, realistic camera than the old 2:1 grid.
 */
export function realisticToScreen(wx: number, wy: number): { x: number; y: number } {
  const u = Math.min(1, Math.max(0, wx / GRID_COLS));
  const v = Math.min(1, Math.max(0, wy / GRID_ROWS));
  const backLeft = { x: 191, y: 70 };
  const backRight = { x: 1090, y: 133 };
  const frontRight = { x: 883, y: 703 };
  const frontLeft = { x: 266, y: 703 };

  return {
    x:
      backLeft.x * (1 - u) * (1 - v) +
      backRight.x * u * (1 - v) +
      frontRight.x * u * v +
      frontLeft.x * (1 - u) * v,
    y:
      backLeft.y * (1 - u) * (1 - v) +
      backRight.y * u * (1 - v) +
      frontRight.y * u * v +
      frontLeft.y * (1 - u) * v,
  };
}

/** Painter's-algorithm depth for zIndex sorting inside the world container. */
export function isoDepth(wx: number, wy: number): number {
  return wx + wy;
}

/** Skew (radians) that maps a flat sprite onto a north-wall face (the wall running screen right-down). */
export const NORTH_WALL_SKEW_Y = Math.atan2(TILE_H / 2, TILE_W / 2);
