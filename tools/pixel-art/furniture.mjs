import { createGrid, fillRect, fillEllipse, gridToStrings } from "./lib/shapes.mjs";
import { rasterizeGrid, writePng } from "./lib/raster.mjs";

const SCALE = 5;

function save(grid, palette, name) {
  const png = rasterizeGrid(gridToStrings(grid), palette, { scale: SCALE });
  writePng(png, new URL(`../../apps/web/public/sprites/prop_${name}.png`, import.meta.url));
}

function generateDesk() {
  const grid = createGrid(20, 20);
  fillRect(grid, 6, 4, 8, 7, "f"); // monitor frame
  fillRect(grid, 7, 5, 6, 5, "c"); // screen glow
  fillRect(grid, 9, 11, 2, 3, "g"); // monitor stand
  fillRect(grid, 1, 14, 18, 3, "d"); // desk top
  fillRect(grid, 2, 17, 2, 3, "g"); // left leg
  fillRect(grid, 16, 17, 2, 3, "g"); // right leg
  save(
    grid,
    {
      f: [55, 65, 81, 255],
      c: [125, 211, 252, 255],
      g: [87, 63, 42, 255],
      d: [139, 101, 62, 255],
    },
    "desk"
  );
}

function generateBookshelf() {
  const grid = createGrid(18, 22, "w");
  fillRect(grid, 1, 1, 16, 20, "i"); // interior
  // 3 shelf bands with book spines
  const spineColors = ["r", "y", "n", "x"];
  let colorIdx = 0;
  for (const shelfY of [2, 9, 16]) {
    fillRect(grid, 1, shelfY + 6, 16, 1, "w"); // shelf board line
    for (let x = 2; x < 17; x += 2) {
      const ch = spineColors[colorIdx % spineColors.length];
      colorIdx += 1;
      fillRect(grid, x, shelfY, 1, 6, ch);
    }
  }
  save(
    grid,
    {
      w: [101, 67, 33, 255],
      i: [61, 43, 27, 255],
      r: [200, 80, 70, 255],
      y: [222, 184, 90, 255],
      n: [90, 120, 160, 255],
      x: [110, 150, 100, 255],
    },
    "bookshelf"
  );
}

function generatePlant() {
  const grid = createGrid(12, 16);
  fillEllipse(grid, 6, 5, 5, 5, "l");
  fillEllipse(grid, 4, 3, 2.5, 2.5, "d");
  fillEllipse(grid, 8, 4, 2, 2, "d");
  fillRect(grid, 3, 11, 6, 2, "p");
  fillRect(grid, 4, 13, 4, 3, "p");
  save(
    grid,
    {
      l: [76, 165, 96, 255],
      d: [52, 130, 74, 255],
      p: [180, 120, 80, 255],
    },
    "plant"
  );
}

function generateReceptionDesk() {
  const grid = createGrid(28, 16);
  fillRect(grid, 0, 6, 28, 8, "d");
  fillRect(grid, 0, 5, 28, 1, "H"); // countertop highlight
  fillRect(grid, 2, 14, 3, 2, "g");
  fillRect(grid, 23, 14, 3, 2, "g");
  fillRect(grid, 11, 2, 6, 4, "s"); // small sign/plate
  save(
    grid,
    {
      d: [30, 58, 95, 255],
      H: [64, 100, 148, 255],
      g: [20, 38, 63, 255],
      s: [226, 232, 240, 255],
    },
    "reception"
  );
}

function generateServerRack() {
  const grid = createGrid(14, 22, "b");
  for (let y = 2; y < 20; y += 3) {
    fillRect(grid, 2, y, 2, 1, "g");
    fillRect(grid, 5, y, 2, 1, "a");
    fillRect(grid, 10, y, 2, 1, "g");
  }
  save(
    grid,
    {
      b: [40, 48, 58, 255],
      g: [74, 222, 128, 255],
      a: [251, 191, 36, 255],
    },
    "server"
  );
}

export function generateFurniture() {
  generateDesk();
  generateBookshelf();
  generatePlant();
  generateReceptionDesk();
  generateServerRack();
  console.log("Generated furniture props: desk, bookshelf, plant, reception, server");
}
