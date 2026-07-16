import { createGrid, fillRect, fillEllipse, gridToStrings, extractLayer, excludeLayer } from "./lib/shapes.mjs";
import { rasterizeGrid, writePng } from "./lib/raster.mjs";

const WIDTH = 16;
const HEIGHT = 20;
const SCALE = 6;

/** Fixed (non-tinted) colors: hair, skin, eyes, pants. The shirt ('b') is left as a separate tintable layer. */
const DETAIL_PALETTE = {
  h: [61, 40, 25, 255], // hair
  s: [255, 214, 170, 255], // skin
  e: [40, 32, 28, 255], // eyes
  p: [55, 65, 81, 255], // pants
};
const BODY_PALETTE = {
  w: [255, 255, 255, 255], // pure white so PIXI tint multiplies cleanly to any role color
};

const HAND_POSITIONS = {
  idle: { left: [1, 13], right: [13, 13] },
  working: { left: [4, 15], right: [10, 15] },
  error: { left: [2, 8], right: [12, 8] },
  completed: { left: [1, 5], right: [13, 5] },
};

function buildBaseGrid() {
  const grid = createGrid(WIDTH, HEIGHT);
  fillEllipse(grid, 8, 3, 5.5, 3.5, "h"); // hair cap
  fillEllipse(grid, 8, 6, 4.5, 4.5, "s"); // face (overwrites lower hair -> leaves a hair "cap" fringe)
  setPixelSafe(grid, 6, 7, "e");
  setPixelSafe(grid, 10, 7, "e");
  fillRect(grid, 3, 11, 10, 6, "b"); // shirt torso (tintable)
  fillRect(grid, 5, 17, 2, 3, "p"); // left leg
  fillRect(grid, 9, 17, 2, 3, "p"); // right leg
  return grid;
}

function setPixelSafe(grid, x, y, ch) {
  grid[y][x] = ch;
}

function buildPoseGrid(pose) {
  const grid = buildBaseGrid();
  const hands = HAND_POSITIONS[pose];
  fillRect(grid, hands.left[0], hands.left[1], 2, 2, "s");
  fillRect(grid, hands.right[0], hands.right[1], 2, 2, "s");
  return grid;
}

function generatePose(pose) {
  const combined = buildPoseGrid(pose);
  const bodyGrid = extractLayer(combined, "b", "w");
  const detailsGrid = excludeLayer(combined, "b");

  const bodyPng = rasterizeGrid(gridToStrings(bodyGrid), BODY_PALETTE, { scale: SCALE });
  const detailsPng = rasterizeGrid(gridToStrings(detailsGrid), DETAIL_PALETTE, { scale: SCALE });

  writePng(bodyPng, new URL(`../../apps/web/public/sprites/char_${pose}_body.png`, import.meta.url));
  writePng(detailsPng, new URL(`../../apps/web/public/sprites/char_${pose}_details.png`, import.meta.url));
}

export function generateCharacters() {
  for (const pose of Object.keys(HAND_POSITIONS)) generatePose(pose);
  console.log("Generated character sprites:", Object.keys(HAND_POSITIONS).join(", "));
}
