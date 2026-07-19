/** Small procedural helpers for building pixel-grid sprites by geometry instead of hand-typed
 * ASCII art (much less error-prone), while still producing genuine per-pixel raster output. */

export function createGrid(width, height, fill = ".") {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

export function setPixel(grid, x, y, ch) {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
  grid[y][x] = ch;
}

export function fillRect(grid, x0, y0, w, h, ch) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) setPixel(grid, x, y, ch);
  }
}

/** Fills an axis-aligned ellipse centered at (cx, cy) with radii (rx, ry), using pixel centers. */
export function fillEllipse(grid, cx, cy, rx, ry, ch) {
  const height = grid.length;
  const width = grid[0].length;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) grid[y][x] = ch;
    }
  }
}

/** Scanline fill of an arbitrary polygon (array of [x, y] points), used for isometric box faces. */
export function fillPolygon(grid, points, ch) {
  const height = grid.length;
  const width = grid[0].length;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, py] of points) {
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(height - 1, Math.ceil(maxY)); y += 1) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0; i < points.length; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) {
        xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xStart = Math.max(0, Math.ceil(xs[k] - 0.5));
      const xEnd = Math.min(width - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xStart; x <= xEnd; x += 1) grid[y][x] = ch;
    }
  }
}

export function gridToStrings(grid) {
  return grid.map((row) => row.join(""));
}

/** Extracts a single-color "mask" grid: pixels matching `ch` become `outCh`, everything else transparent. */
export function extractLayer(grid, ch, outCh) {
  return grid.map((row) => row.map((cell) => (cell === ch ? outCh : ".")));
}

/** Everything except pixels matching `ch` (which become transparent); used to peel off the tintable region. */
export function excludeLayer(grid, ch) {
  return grid.map((row) => row.map((cell) => (cell === ch ? "." : cell)));
}
