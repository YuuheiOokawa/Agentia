import { createGrid, fillRect, gridToStrings } from "./lib/shapes.mjs";
import { rasterizeGrid, writePng } from "./lib/raster.mjs";

const SCALE = 4;

/**
 * カイロソフト風オフィスを意識した環境タイル。
 *
 * PIXI側でエリアごとに tint を掛けることを前提に、
 * 完全なカラー画像ではなく、暖色系グレースケールで作成する。
 *
 * 明るさの差を残すことで tint 後も
 * 木目・壁の凹凸・影が消えないようにする。
 */
const PALETTE = {
  // highlights
  h: [250, 244, 232, 255],

  // main light
  a: [232, 220, 200, 255],

  // main medium
  b: [205, 190, 167, 255],

  // dark detail
  c: [174, 157, 134, 255],

  // shadow
  d: [135, 120, 102, 255],

  // deepest outline
  e: [92, 82, 70, 255],
};

/**
 * 木の床
 *
 * 32x32にすることで、
 * 単純な繰り返し感を減らしてゲームらしい床にする。
 *
 * PIXI上では32pxタイルとして配置可能。
 */
function generateFloorTile() {
  const SIZE = 32;
  const grid = createGrid(SIZE, SIZE, "b");

  // --------------------------------
  // 木板
  // --------------------------------

  // 1段目
  fillRect(grid, 0, 0, 15, 7, "a");
  fillRect(grid, 16, 0, 16, 7, "b");

  // 2段目
  fillRect(grid, 0, 8, 8, 7, "b");
  fillRect(grid, 9, 8, 16, 7, "a");
  fillRect(grid, 26, 8, 6, 7, "b");

  // 3段目
  fillRect(grid, 0, 16, 20, 7, "a");
  fillRect(grid, 21, 16, 11, 7, "b");

  // 4段目
  fillRect(grid, 0, 24, 11, 8, "b");
  fillRect(grid, 12, 24, 20, 8, "a");

  // --------------------------------
  // 横方向の板の境界
  // --------------------------------

  fillRect(grid, 0, 7, 32, 1, "d");
  fillRect(grid, 0, 15, 32, 1, "d");
  fillRect(grid, 0, 23, 32, 1, "d");

  // 境界のハイライト
  fillRect(grid, 0, 8, 32, 1, "h");
  fillRect(grid, 0, 16, 32, 1, "h");
  fillRect(grid, 0, 24, 32, 1, "h");

  // --------------------------------
  // 縦方向の板の継ぎ目
  // --------------------------------

  // 1段目
  fillRect(grid, 15, 0, 1, 7, "d");

  // 2段目
  fillRect(grid, 8, 8, 1, 7, "d");
  fillRect(grid, 25, 8, 1, 7, "d");

  // 3段目
  fillRect(grid, 20, 16, 1, 7, "d");

  // 4段目
  fillRect(grid, 11, 24, 1, 8, "d");

  // --------------------------------
  // 木目
  // --------------------------------

  // 板1
  fillRect(grid, 3, 2, 7, 1, "c");
  fillRect(grid, 5, 4, 5, 1, "c");

  // 板2
  fillRect(grid, 20, 3, 8, 1, "c");

  // 板3
  fillRect(grid, 11, 11, 9, 1, "c");
  fillRect(grid, 14, 13, 5, 1, "c");

  // 板4
  fillRect(grid, 3, 19, 10, 1, "c");

  // 板5
  fillRect(grid, 16, 27, 10, 1, "c");
  fillRect(grid, 18, 29, 5, 1, "c");

  // 小さな節
  fillRect(grid, 12, 3, 2, 1, "d");
  fillRect(grid, 27, 18, 2, 1, "d");
  fillRect(grid, 5, 27, 2, 1, "d");

  const png = rasterizeGrid(
    gridToStrings(grid),
    PALETTE,
    { scale: SCALE }
  );

  writePng(
    png,
    new URL(
      "../../apps/web/public/sprites/tile_floor.png",
      import.meta.url
    )
  );
}

/**
 * オフィス内壁
 *
 * 画像のような
 *
 * 上部：明るい漆喰・コンクリート
 * 中部：パネル
 * 下部：濃い巾木
 *
 * の3層構造。
 */
function generateWallTile() {
  const WIDTH = 32;
  const HEIGHT = 32;

  const grid = createGrid(WIDTH, HEIGHT, "a");

  // --------------------------------
  // 上部壁
  // --------------------------------

  fillRect(grid, 0, 0, 32, 18, "a");

  // ランダム感のある壁面模様
  fillRect(grid, 3, 4, 8, 1, "b");
  fillRect(grid, 19, 6, 9, 1, "b");

  fillRect(grid, 6, 11, 5, 1, "h");
  fillRect(grid, 22, 13, 6, 1, "b");

  // --------------------------------
  // パネル境界
  // --------------------------------

  fillRect(grid, 0, 18, 32, 2, "c");

  // 上側ハイライト
  fillRect(grid, 0, 18, 32, 1, "h");

  // --------------------------------
  // 下部パネル
  // --------------------------------

  fillRect(grid, 0, 20, 32, 8, "b");

  // パネル縦線
  fillRect(grid, 0, 20, 1, 8, "d");
  fillRect(grid, 10, 20, 1, 8, "c");
  fillRect(grid, 21, 20, 1, 8, "c");
  fillRect(grid, 31, 20, 1, 8, "d");

  // パネル上部ハイライト
  fillRect(grid, 1, 20, 30, 1, "h");

  // --------------------------------
  // 巾木
  // --------------------------------

  fillRect(grid, 0, 28, 32, 4, "d");

  // 巾木上部
  fillRect(grid, 0, 28, 32, 1, "c");

  // 最下部の影
  fillRect(grid, 0, 31, 32, 1, "e");

  const png = rasterizeGrid(
    gridToStrings(grid),
    PALETTE,
    { scale: SCALE }
  );

  writePng(
    png,
    new URL(
      "../../apps/web/public/sprites/tile_wall.png",
      import.meta.url
    )
  );
}

/**
 * 部屋の境界用タイル。
 *
 * 画像のように部屋ごとに
 * 「床が少し高くなっている」印象を作る。
 */
function generateFloorEdgeTile() {
  const grid = createGrid(32, 8, "b");

  // 床表面
  fillRect(grid, 0, 0, 32, 2, "h");

  // 正面部分
  fillRect(grid, 0, 2, 32, 4, "c");

  // 奥行きを出す影
  fillRect(grid, 0, 6, 32, 2, "e");

  // ブロック区切り
  fillRect(grid, 10, 2, 1, 4, "d");
  fillRect(grid, 21, 2, 1, 4, "d");

  const png = rasterizeGrid(
    gridToStrings(grid),
    PALETTE,
    { scale: SCALE }
  );

  writePng(
    png,
    new URL(
      "../../apps/web/public/sprites/tile_floor_edge.png",
      import.meta.url
    )
  );
}

/**
 * 部屋の仕切り壁。
 *
 * Claude Codeの処理エリアを
 *
 * PLAN
 * RESEARCH
 * CODE
 * TEST
 *
 * のように区切るために使用。
 */
function generatePartitionTile() {
  const grid = createGrid(16, 24, "b");

  // 上面
  fillRect(grid, 0, 0, 16, 3, "h");

  // 壁
  fillRect(grid, 0, 3, 16, 17, "b");

  // 左ハイライト
  fillRect(grid, 0, 3, 1, 17, "a");

  // 右影
  fillRect(grid, 15, 3, 1, 17, "d");

  // 下側
  fillRect(grid, 0, 20, 16, 4, "d");

  // 最下部
  fillRect(grid, 0, 23, 16, 1, "e");

  const png = rasterizeGrid(
    gridToStrings(grid),
    PALETTE,
    { scale: SCALE }
  );

  writePng(
    png,
    new URL(
      "../../apps/web/public/sprites/tile_partition.png",
      import.meta.url
    )
  );
}

export function generateEnvironment() {
  generateFloorTile();
  generateWallTile();
  generateFloorEdgeTile();
  generatePartitionTile();

  console.log(`
Generated environment tiles:

- tile_floor.png
  木目付きオフィス床

- tile_wall.png
  上壁＋腰壁＋巾木

- tile_floor_edge.png
  部屋の立体感を出す床境界

- tile_partition.png
  各Claude Code処理エリアの仕切り壁
`);
}
