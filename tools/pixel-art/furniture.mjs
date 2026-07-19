import {
  createGrid,
  fillRect,
  fillEllipse,
  fillPolygon,
  gridToStrings,
} from "./lib/shapes.mjs";

import {
  rasterizeGrid,
  writePng,
} from "./lib/raster.mjs";

const SCALE = 5;

/**
 * 什器を本物のアイソメトリック(ボクセル調)で生成する(docs/07 "よりグラフィックを3D")。
 *
 * オフィスキャンバス側の投影(iso.ts)と同じ 2:1 等角投影:
 * - ワールド +x はスプライト内で「左上」方向(2px左で1px上)
 * - ワールド +y は「右上」方向
 * - 手前の角(最も奥行きが大きい点)がスプライトの下端
 *
 * 各ボックスは 天面(最も明るい)・南面(中間、着席キャラ側)・東面(最も暗い)
 * の3面で構成され、光源が上にある立体として読めるようにする。
 */

function save(grid, palette, name) {
  const png = rasterizeGrid(gridToStrings(grid), palette, { scale: SCALE });
  writePng(png, new URL(`../../apps/web/public/sprites/prop_${name}.png`, import.meta.url));
}

/**
 * 2:1 アイソメトリックの直方体。
 * (cx, by) が手前下の角。A = x方向の奥行き(単位)、B = y方向の奥行き、H = 高さpx。
 */
function isoBox(grid, cx, by, A, B, H, chTop, chSouth, chEast) {
  const Fb = [cx, by];
  const Xb = [cx - 2 * A, by - A];
  const Yb = [cx + 2 * B, by - B];
  const Fr = [cx, by - H];
  const Xr = [cx - 2 * A, by - A - H];
  const Yr = [cx + 2 * B, by - B - H];
  const Br = [cx - 2 * A + 2 * B, by - A - B - H];
  fillPolygon(grid, [Fb, Yb, Yr, Fr], chEast);
  fillPolygon(grid, [Fb, Xb, Xr, Fr], chSouth);
  fillPolygon(grid, [Fr, Xr, Br, Yr], chTop);
}

/**
 * 南面(左下向きの面)の上に、面の傾きに沿ってコンテンツを描く。
 * u0..u1 は面上の x 方向の範囲(単位)、hBottom は面の下端からの高さpx、hHeight は高さpx。
 */
function southRect(grid, cx, by, u0, u1, hBottom, hHeight, ch) {
  const start = Math.round(u0 * 2);
  const end = Math.round(u1 * 2);
  const h = Math.max(1, Math.round(hHeight));
  for (let dx = start; dx < end; dx += 1) {
    const x = cx - dx;
    const yb = by - Math.round(dx / 2);
    fillRect(grid, x, Math.round(yb - hBottom - h + 1), 1, h, ch);
  }
}

// ================================
// PC付きデスク
// ================================
function generateDesk() {
  const grid = createGrid(26, 30);
  const cx = 16;
  const by = 27;

  isoBox(grid, cx, by, 7, 4, 5, "T", "S", "E");

  // 脚の影(南面の下)
  southRect(grid, cx, by, 0.3, 6.7, -1, 1, "E");

  // モニター(天板の奥側、南向きスクリーン)
  const b = 2.5;
  const u0 = 1.5;
  const mx = Math.round(cx + 2 * b - 2 * u0);
  const my = Math.round(by - 5 - b - u0);
  isoBox(grid, mx, my, 4, 0.75, 7, "F", "F", "G");
  southRect(grid, mx, my, 0.4, 3.6, 1.5, 4.5, "C");
  southRect(grid, mx, my, 0.6, 2.2, 4.8, 1, "c");

  // キーボード
  isoBox(grid, 14, 19, 3, 1, 1, "K", "F", "G");

  // マグカップ
  fillRect(grid, 21, 17, 2, 3, "W");

  save(
    grid,
    {
      T: [224, 177, 111, 255],
      S: [189, 137, 80, 255],
      E: [143, 94, 52, 255],
      F: [51, 60, 69, 255],
      G: [38, 45, 52, 255],
      K: [83, 94, 103, 255],
      C: [125, 211, 252, 255],
      c: [200, 240, 255, 255],
      W: [237, 232, 220, 255],
    },
    "desk"
  );
}

// ================================
// 本棚
// ================================
function generateBookshelf() {
  const grid = createGrid(22, 32);
  const cx = 16;
  const by = 29;

  isoBox(grid, cx, by, 7, 2, 17, "T", "S", "E");

  // 棚板と本(南面)
  const bookColors = ["R", "Y", "B", "G", "Q"];
  for (const [shelfIdx, hb] of [1, 6, 11].entries()) {
    southRect(grid, cx, by, 0.2, 6.8, hb - 1, 1, "E");
    let colorIdx = shelfIdx;
    for (let u = 0.5; u < 6.4; u += 0.75) {
      const ch = bookColors[colorIdx % bookColors.length];
      colorIdx += 1;
      const h = 3 + (colorIdx % 2);
      southRect(grid, cx, by, u, u + 0.6, hb, h, ch);
    }
  }
  southRect(grid, cx, by, 0.2, 6.8, 15, 1, "E");

  save(
    grid,
    {
      T: [189, 137, 80, 255],
      S: [120, 80, 45, 255],
      E: [94, 61, 37, 255],
      R: [200, 80, 70, 255],
      Y: [222, 184, 90, 255],
      B: [90, 120, 160, 255],
      G: [110, 150, 100, 255],
      Q: [236, 209, 165, 255],
    },
    "bookshelf"
  );
}

// ================================
// サーバーラック
// ================================
function generateServerRack() {
  const grid = createGrid(20, 34);
  const cx = 11;
  const by = 31;

  isoBox(grid, cx, by, 4, 3, 20, "T", "S", "E");

  for (const hb of [2, 6, 10, 14]) {
    southRect(grid, cx, by, 0.3, 3.7, hb + 3, 1, "P");
    southRect(grid, cx, by, 0.5, 1, hb + 1, 1, "L");
    southRect(grid, cx, by, 1.4, 1.9, hb + 1, 1, "A");
    southRect(grid, cx, by, 2.4, 3.5, hb + 1, 1, "V");
  }

  save(
    grid,
    {
      T: [83, 94, 103, 255],
      S: [51, 60, 69, 255],
      E: [40, 48, 58, 255],
      P: [70, 80, 90, 255],
      L: [81, 211, 117, 255],
      A: [232, 184, 68, 255],
      V: [30, 34, 38, 255],
    },
    "server"
  );
}

// ================================
// キャビネット
// ================================
function generateCabinet() {
  const grid = createGrid(18, 22);
  const cx = 10;
  const by = 19;

  isoBox(grid, cx, by, 3, 2, 10, "T", "S", "E");

  for (const hb of [1, 4, 7]) {
    southRect(grid, cx, by, 0.3, 2.7, hb, 2, "D");
    southRect(grid, cx, by, 1.2, 1.8, hb + 1, 1, "M");
  }

  save(
    grid,
    {
      T: [224, 177, 111, 255],
      S: [189, 137, 80, 255],
      E: [143, 94, 52, 255],
      D: [165, 115, 65, 255],
      M: [51, 60, 69, 255],
    },
    "cabinet"
  );
}

// ================================
// ソファ
// ================================
function generateCouch() {
  const grid = createGrid(26, 22);
  const cx = 17;
  const by = 19;

  // 座面
  isoBox(grid, cx, by, 7, 3, 4, "T", "S", "E");
  // 背もたれ(奥側)
  isoBox(grid, cx + 4, by - 6, 7, 0.8, 6, "T", "S", "E");
  // 肘掛け(両端)
  isoBox(grid, cx - 12, by - 6, 0.9, 3, 6, "T", "S", "E");
  isoBox(grid, cx, by, 0.9, 3, 6, "T", "S", "E");
  // 座面クッションの継ぎ目
  southRect(grid, cx, by, 3.4, 3.6, 0.5, 3, "E");

  save(
    grid,
    {
      T: [104, 135, 163, 255],
      S: [65, 88, 112, 255],
      E: [37, 54, 73, 255],
    },
    "couch"
  );
}

// ================================
// 自動販売機
// ================================
function generateVendingMachine() {
  const grid = createGrid(18, 32);
  const cx = 9;
  const by = 29;

  isoBox(grid, cx, by, 3, 3, 19, "T", "S", "E");

  // 商品窓
  southRect(grid, cx, by, 0.4, 2.6, 8, 9, "G");
  const productColors = ["o", "Y", "L"];
  let colorIdx = 0;
  for (const hb of [9, 12, 15]) {
    for (let u = 0.7; u < 2.4; u += 0.7) {
      const ch = productColors[colorIdx % productColors.length];
      colorIdx += 1;
      southRect(grid, cx, by, u, u + 0.5, hb, 2, ch);
    }
  }
  // 取り出し口
  southRect(grid, cx, by, 0.5, 2.5, 2, 3, "V");

  save(
    grid,
    {
      T: [219, 110, 100, 255],
      S: [183, 73, 63, 255],
      E: [140, 50, 45, 255],
      G: [39, 83, 100, 255],
      o: [230, 120, 90, 255],
      Y: [232, 184, 68, 255],
      L: [81, 211, 117, 255],
      V: [40, 44, 48, 255],
    },
    "vending_machine"
  );
}

// ================================
// ホワイトボード
// ================================
function generateWhiteboard() {
  const grid = createGrid(24, 24);
  const cx = 18;
  const by = 21;

  // 脚
  fillRect(grid, 16, 15, 2, 6, "F");
  fillRect(grid, 5, 10, 2, 6, "F");

  // ボード(南向きの薄いパネル)
  isoBox(grid, cx, by - 4, 7, 0.7, 10, "F", "F", "G");
  southRect(grid, cx, by - 4, 0.4, 6.6, 1, 8, "W");

  // 図っぽい線とノード
  southRect(grid, cx, by - 4, 1, 3.5, 6.5, 1, "B");
  southRect(grid, cx, by - 4, 2, 5.5, 4, 1, "R");
  southRect(grid, cx, by - 4, 1.2, 2, 2, 1.5, "Y");
  southRect(grid, cx, by - 4, 4.5, 5.3, 2, 1.5, "B");

  save(
    grid,
    {
      F: [83, 94, 103, 255],
      G: [51, 60, 69, 255],
      W: [237, 232, 220, 255],
      B: [72, 113, 150, 255],
      R: [183, 73, 63, 255],
      Y: [211, 164, 65, 255],
    },
    "whiteboard"
  );
}

// ================================
// モニターウォール
// ================================
function generateMonitorWall() {
  const grid = createGrid(26, 26);
  const cx = 21;
  const by = 23;

  isoBox(grid, cx, by, 9, 0.8, 12, "F", "F", "G");

  for (const hb of [1.5, 6.5]) {
    for (const u of [0.6, 3.4, 6.2]) {
      southRect(grid, cx, by, u, u + 2.3, hb, 4, "D");
      southRect(grid, cx, by, u + 0.3, u + 1.7, hb + 1, 1, "L");
      southRect(grid, cx, by, u + 0.9, u + 2, hb + 2.4, 1, "C");
    }
  }

  save(
    grid,
    {
      F: [45, 52, 60, 255],
      G: [30, 34, 38, 255],
      D: [39, 83, 100, 255],
      L: [81, 211, 117, 255],
      C: [173, 232, 236, 255],
    },
    "monitor_wall"
  );
}

// ================================
// 会議テーブル
// ================================
function generateConferenceTable() {
  const grid = createGrid(32, 26);
  const cx = 20;
  const by = 23;

  isoBox(grid, cx, by, 9, 5, 6, "T", "S", "E");

  // 天板の資料(白い小さなひし形)
  for (const [a, b] of [[2.5, 1.5], [5.5, 3], [3.5, 3.5]]) {
    const px = cx - 2 * a + 2 * b;
    const py = by - 6 - a - b;
    fillPolygon(grid, [[px, py - 1], [px + 3, py + 0.5], [px, py + 2], [px - 3, py + 0.5]], "P");
  }

  save(
    grid,
    {
      T: [224, 177, 111, 255],
      S: [189, 137, 80, 255],
      E: [143, 94, 52, 255],
      P: [237, 232, 220, 255],
    },
    "conference_table"
  );
}

// ================================
// 観葉植物
// ================================
function generatePlant() {
  const grid = createGrid(18, 26);
  const cx = 9;
  const by = 23;

  isoBox(grid, cx, by, 2, 2, 4, "p", "P", "D");

  // 幹
  fillRect(grid, 8, 13, 2, 5, "K");

  // 葉(複数の房)
  fillEllipse(grid, 9, 9, 5, 4, "G");
  fillEllipse(grid, 5, 10, 3, 3, "g");
  fillEllipse(grid, 13, 10, 3, 3, "G");
  fillEllipse(grid, 8, 6, 3, 2.5, "L");
  fillEllipse(grid, 12, 7, 2.5, 2, "g");
  fillRect(grid, 7, 6, 2, 1, "H");

  save(
    grid,
    {
      p: [219, 155, 102, 255],
      P: [183, 112, 67, 255],
      D: [150, 85, 50, 255],
      K: [94, 61, 37, 255],
      G: [123, 190, 94, 255],
      g: [74, 150, 78, 255],
      L: [96, 170, 88, 255],
      H: [175, 216, 126, 255],
    },
    "plant"
  );
}

// ================================
// 受付カウンター(未使用だがテクスチャ参照が残っているため維持)
// ================================
function generateReceptionDesk() {
  const grid = createGrid(30, 22);
  const cx = 19;
  const by = 19;

  isoBox(grid, cx, by, 8, 4, 8, "T", "S", "E");
  southRect(grid, cx, by, 1.5, 6.5, 3, 3, "B");
  southRect(grid, cx, by, 2, 6, 4, 1, "Q");

  save(
    grid,
    {
      T: [224, 177, 111, 255],
      S: [143, 94, 52, 255],
      E: [110, 70, 40, 255],
      B: [37, 54, 73, 255],
      Q: [237, 232, 220, 255],
    },
    "reception"
  );
}

// ================================
// 外壁の窓(壁面に貼るフラット素材のため従来のまま)
// ================================
function generateWindow() {
  const grid = createGrid(16, 14, "O");
  fillRect(grid, 1, 1, 14, 12, "F");
  fillRect(grid, 2, 2, 12, 10, "G");
  fillRect(grid, 2, 2, 12, 4, "g");
  fillRect(grid, 7, 2, 2, 10, "F");
  fillRect(grid, 2, 7, 12, 1, "F");
  fillRect(grid, 1, 1, 14, 1, "L");

  save(
    grid,
    {
      O: [67, 53, 43, 255],
      F: [232, 232, 226, 255],
      L: [237, 232, 220, 255],
      G: [141, 199, 224, 255],
      g: [201, 232, 244, 255],
    },
    "window"
  );
}

export function generateFurniture() {
  generateDesk();
  generateBookshelf();
  generateServerRack();
  generateCabinet();
  generateCouch();
  generateVendingMachine();
  generateWhiteboard();
  generateMonitorWall();
  generateConferenceTable();
  generatePlant();
  generateReceptionDesk();
  generateWindow();

  console.log(`
Generated ISOMETRIC furniture props:
desk / bookshelf / server / cabinet / couch / vending_machine /
whiteboard / monitor_wall / conference_table / plant / reception / window
(全てボクセル調: 天面+南面+東面の3面構成)
`);
}
