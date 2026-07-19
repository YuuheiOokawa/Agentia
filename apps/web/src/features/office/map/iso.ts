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
const MARGIN_BOTTOM = 56;

/** How many tiles of grey sidewalk ring the building (docs/07: grounds the diorama like the reference). */
export const APRON_TILES = 2;

/** Screen position of world origin (0,0): pushed right so the grid's leftmost corner (0, GRID_ROWS) fits. */
export const ORIGIN_X = MARGIN_X + GRID_ROWS * (TILE_W / 2);
export const ORIGIN_Y = MARGIN_TOP;

export const OFFICE_WIDTH = ORIGIN_X + GRID_COLS * (TILE_W / 2) + MARGIN_X;
export const OFFICE_HEIGHT = ORIGIN_Y + (GRID_COLS + GRID_ROWS) * (TILE_H / 2) + MARGIN_BOTTOM;

export function isoToScreen(wx: number, wy: number): { x: number; y: number } {
  return {
    x: ORIGIN_X + (wx - wy) * (TILE_W / 2),
    y: ORIGIN_Y + (wx + wy) * (TILE_H / 2),
  };
}

/** Painter's-algorithm depth for zIndex sorting inside the world container. */
export function isoDepth(wx: number, wy: number): number {
  return wx + wy;
}

/** Skew (radians) that maps a flat sprite onto a north-wall face (the wall running screen right-down). */
export const NORTH_WALL_SKEW_Y = Math.atan2(TILE_H / 2, TILE_W / 2);
