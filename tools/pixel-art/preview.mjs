import { PNG } from "pngjs";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const spritesDir = fileURLToPath(new URL("../../apps/web/public/sprites/", import.meta.url));
const outDir = fileURLToPath(new URL("./preview-out/", import.meta.url));
mkdirSync(outDir, { recursive: true });

function load(name) {
  return PNG.sync.read(readFileSync(spritesDir + name));
}

function tint(png, [r, g, b]) {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.data.length; i += 4) {
    out.data[i] = Math.round((png.data[i] / 255) * r);
    out.data[i + 1] = Math.round((png.data[i + 1] / 255) * g);
    out.data[i + 2] = Math.round((png.data[i + 2] / 255) * b);
    out.data[i + 3] = png.data[i + 3];
  }
  return out;
}

function compositeOnto(base, layer) {
  for (let y = 0; y < layer.height; y += 1) {
    for (let x = 0; x < layer.width; x += 1) {
      const idx = (layer.width * y + x) << 2;
      const a = layer.data[idx + 3];
      if (a === 0) continue;
      base.data[idx] = layer.data[idx];
      base.data[idx + 1] = layer.data[idx + 1];
      base.data[idx + 2] = layer.data[idx + 2];
      base.data[idx + 3] = 255;
    }
  }
}

const roleBlue = [30, 136, 229];
const roleGreen = [67, 160, 71];

const grid = new PNG({ width: 800, height: 280 });
// fill light gray background for visibility
for (let i = 0; i < grid.data.length; i += 4) {
  grid.data[i] = 235;
  grid.data[i + 1] = 235;
  grid.data[i + 2] = 235;
  grid.data[i + 3] = 255;
}

const poses = ["idle", "working", "error", "completed"];
poses.forEach((pose, i) => {
  const body = tint(load(`char_${pose}_body.png`), i % 2 === 0 ? roleBlue : roleGreen);
  const details = load(`char_${pose}_details.png`);
  const composed = new PNG({ width: 96, height: 120 });
  compositeOnto(composed, body);
  compositeOnto(composed, details);
  PNG.bitblt(composed, grid, 0, 0, 96, 120, i * 96, 0);
});

// environment + furniture row
const envNames = ["tile_floor.png", "tile_wall.png", "prop_desk.png", "prop_bookshelf.png", "prop_plant.png", "prop_reception.png", "prop_server.png"];
let xOffset = 0;
for (const name of envNames) {
  const png = load(name);
  PNG.bitblt(png, grid, 0, 0, png.width, png.height, xOffset, 130);
  xOffset += png.width + 10;
}

writeFileSync(outDir + "preview.png", PNG.sync.write(grid));
console.log("wrote", outDir + "preview.png");
