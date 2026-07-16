import { createGrid, fillRect, gridToStrings } from "./lib/shapes.mjs";
import { rasterizeGrid, writePng } from "./lib/raster.mjs";

const SCALE = 4;

/** Grayscale so PIXI tint (per-area accent color) multiplies cleanly while keeping plank/seam contrast. */
const TINTABLE_PALETTE = {
  a: [245, 240, 230, 255],
  b: [222, 214, 199, 255],
  l: [186, 176, 160, 255],
};

function generateFloorTile() {
  const grid = createGrid(16, 16);
  fillRect(grid, 0, 0, 16, 3, "a");
  fillRect(grid, 0, 3, 16, 1, "l");
  fillRect(grid, 0, 4, 16, 3, "b");
  fillRect(grid, 0, 7, 16, 1, "l");
  fillRect(grid, 0, 8, 16, 3, "a");
  fillRect(grid, 0, 11, 16, 1, "l");
  fillRect(grid, 0, 12, 16, 3, "b");
  fillRect(grid, 0, 15, 16, 1, "l");
  const png = rasterizeGrid(gridToStrings(grid), TINTABLE_PALETTE, { scale: SCALE });
  writePng(png, new URL("../../apps/web/public/sprites/tile_floor.png", import.meta.url));
}

function generateWallTile() {
  const grid = createGrid(16, 24, "a");
  fillRect(grid, 0, 0, 16, 16, "a"); // upper wall panel
  fillRect(grid, 0, 16, 16, 4, "b"); // mid trim band
  fillRect(grid, 0, 20, 16, 4, "l"); // baseboard
  // vertical panel seams
  fillRect(grid, 0, 0, 1, 20, "l");
  fillRect(grid, 7, 0, 1, 20, "l");
  fillRect(grid, 15, 0, 1, 20, "l");
  const png = rasterizeGrid(gridToStrings(grid), TINTABLE_PALETTE, { scale: SCALE });
  writePng(png, new URL("../../apps/web/public/sprites/tile_wall.png", import.meta.url));
}

export function generateEnvironment() {
  generateFloorTile();
  generateWallTile();
  console.log("Generated environment tiles: tile_floor, tile_wall");
}
