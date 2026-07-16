import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Rasterizes a hand-authored pixel grid (array of equal-length strings, one char per pixel)
 * into a real PNG bitmap. '.' is transparent. Any other character must be a key in `palette`.
 * This is the "real pixel art asset" pipeline: sprites are authored as data, not drawn at
 * runtime with vector shapes.
 */
export function rasterizeGrid(grid, palette, { scale = 1 } = {}) {
  const height = grid.length;
  const width = grid[0].length;
  for (const row of grid) {
    if (row.length !== width) throw new Error(`Row length mismatch: expected ${width}, got ${row.length} ("${row}")`);
  }

  const png = new PNG({ width: width * scale, height: height * scale });
  for (let y = 0; y < height; y += 1) {
    const row = grid[y];
    for (let x = 0; x < width; x += 1) {
      const ch = row[x];
      const rgba = ch === "." ? [0, 0, 0, 0] : palette[ch];
      if (!rgba) throw new Error(`Unknown palette key "${ch}" in grid row ${y}`);
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const px = x * scale + sx;
          const py = y * scale + sy;
          const idx = (width * scale * py + px) << 2;
          png.data[idx] = rgba[0];
          png.data[idx + 1] = rgba[1];
          png.data[idx + 2] = rgba[2];
          png.data[idx + 3] = rgba[3] ?? 255;
        }
      }
    }
  }
  return png;
}

export function writePng(png, outPath) {
  const path = outPath instanceof URL ? fileURLToPath(outPath) : outPath;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
}

/** Horizontally concatenates same-height grids into one spritesheet PNG (for animation frames). */
export function rasterizeSheet(grids, palette, { scale = 1 } = {}) {
  const frames = grids.map((g) => rasterizeGrid(g, palette, { scale }));
  const width = frames.reduce((sum, f) => sum + f.width, 0);
  const height = frames[0].height;
  const sheet = new PNG({ width, height });
  let xOffset = 0;
  for (const frame of frames) {
    PNG.bitblt(frame, sheet, 0, 0, frame.width, frame.height, xOffset, 0);
    xOffset += frame.width;
  }
  return { sheet, frameWidth: frames[0].width, frameHeight: height, count: frames.length };
}
