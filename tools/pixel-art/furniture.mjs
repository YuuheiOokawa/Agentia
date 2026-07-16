import {
  createGrid,
  fillRect,
  fillEllipse,
  gridToStrings,
} from "./lib/shapes.mjs";

import {
  rasterizeGrid,
  writePng,
} from "./lib/raster.mjs";

const SCALE = 5;

/**
 * カイロソフト風の家具用共通パレット。
 *
 * 全体的に
 * ・濃いアウトライン
 * ・中間色
 * ・明るいハイライト
 *
 * の3段階以上を使って、
 * 小さいスプライトでも立体感が出るようにする。
 */
const COLORS = {
  outline: [67, 53, 43, 255],

  woodDark: [94, 61, 37, 255],
  wood: [143, 94, 52, 255],
  woodLight: [189, 137, 80, 255],
  woodHighlight: [224, 177, 111, 255],

  metalDark: [51, 60, 69, 255],
  metal: [83, 94, 103, 255],
  metalLight: [139, 151, 158, 255],

  screenDark: [39, 83, 100, 255],
  screen: [89, 190, 210, 255],
  screenLight: [173, 232, 236, 255],

  greenDark: [44, 105, 59, 255],
  green: [74, 150, 78, 255],
  greenLight: [123, 190, 94, 255],

  potDark: [126, 76, 48, 255],
  pot: [183, 112, 67, 255],
  potLight: [219, 155, 102, 255],

  darkBlue: [37, 54, 73, 255],
  blue: [65, 88, 112, 255],
  blueLight: [104, 135, 163, 255],

  black: [35, 39, 42, 255],

  white: [237, 232, 220, 255],

  red: [183, 73, 63, 255],
  yellow: [211, 164, 65, 255],
  bookBlue: [72, 113, 150, 255],
  bookGreen: [78, 137, 90, 255],

  skyBlue: [141, 199, 224, 255],
  skyBlueLight: [201, 232, 244, 255],
  frameLight: [232, 232, 226, 255],
};

function save(grid, palette, name) {
  const png = rasterizeGrid(
    gridToStrings(grid),
    palette,
    {
      scale: SCALE,
    }
  );

  writePng(
    png,
    new URL(
      `../../apps/web/public/sprites/prop_${name}.png`,
      import.meta.url
    )
  );
}

/**
 * PC付きデスク
 *
 * 正面から見た机ではなく、
 * 少し上から見下ろした立体的な形にする。
 */
function generateDesk() {
  const grid = createGrid(28, 28);

  // ================================
  // デスク天板
  // ================================

  // アウトライン
  fillRect(grid, 2, 15, 24, 7, "O");

  // 天板正面
  fillRect(grid, 3, 16, 22, 5, "W");

  // 天板上面
  fillRect(grid, 4, 13, 20, 4, "L");

  // ハイライト
  fillRect(grid, 5, 13, 18, 1, "H");

  // 左右の脚
  fillRect(grid, 4, 21, 4, 6, "D");
  fillRect(grid, 20, 21, 4, 6, "D");

  // 脚のハイライト
  fillRect(grid, 5, 21, 1, 5, "W");
  fillRect(grid, 21, 21, 1, 5, "W");

  // ================================
  // モニター
  // ================================

  // モニター外枠
  fillRect(grid, 8, 3, 12, 10, "M");

  // モニター縁
  fillRect(grid, 9, 4, 10, 8, "m");

  // 画面
  fillRect(grid, 10, 5, 8, 6, "S");

  // 画面ハイライト
  fillRect(grid, 11, 5, 6, 1, "s");

  // コードっぽい表示
  fillRect(grid, 11, 7, 4, 1, "s");
  fillRect(grid, 13, 9, 4, 1, "s");

  // モニタースタンド
  fillRect(grid, 13, 13, 2, 3, "M");

  // 台座
  fillRect(grid, 11, 15, 6, 1, "M");

  // ================================
  // キーボード
  // ================================

  fillRect(grid, 9, 17, 10, 3, "M");
  fillRect(grid, 10, 17, 8, 1, "m");

  // ================================
  // マグカップ
  // ================================

  fillRect(grid, 21, 10, 3, 4, "C");
  fillRect(grid, 24, 11, 1, 2, "C");

  save(
    grid,
    {
      O: COLORS.outline,

      D: COLORS.woodDark,
      W: COLORS.wood,
      L: COLORS.woodLight,
      H: COLORS.woodHighlight,

      M: COLORS.metalDark,
      m: COLORS.metal,

      S: COLORS.screen,
      s: COLORS.screenLight,

      C: COLORS.white,
    },
    "desk"
  );
}

/**
 * 本棚
 *
 * 単なる四角形ではなく、
 * 太い木枠と奥行きを持たせる。
 */
function generateBookshelf() {
  const grid = createGrid(24, 30);

  // 外枠
  fillRect(grid, 2, 1, 20, 28, "O");

  // 本棚本体
  fillRect(grid, 3, 2, 18, 26, "D");

  // 左側ハイライト
  fillRect(grid, 3, 2, 2, 26, "L");

  // 内部
  fillRect(grid, 6, 4, 13, 22, "I");

  // 棚板
  for (const y of [10, 17, 24]) {
    fillRect(grid, 5, y, 15, 2, "W");
    fillRect(grid, 6, y, 13, 1, "H");
  }

  const books = [
    "R",
    "Y",
    "B",
    "G",
    "Y",
    "R",
    "B",
    "G",
  ];

  let index = 0;

  for (const shelfY of [5, 12, 19]) {
    let x = 7;

    while (x < 18) {
      const color = books[index % books.length];

      const height =
        index % 3 === 0
          ? 5
          : index % 3 === 1
            ? 6
            : 4;

      fillRect(
        grid,
        x,
        shelfY + 5 - height,
        2,
        height,
        color
      );

      // 本のハイライト
      fillRect(
        grid,
        x,
        shelfY + 5 - height,
        1,
        height,
        "Q"
      );

      x += 2;
      index += 1;
    }
  }

  // 一番上の装飾
  fillRect(grid, 7, 2, 10, 1, "H");

  save(
    grid,
    {
      O: COLORS.outline,

      D: COLORS.woodDark,
      W: COLORS.wood,
      L: COLORS.woodLight,
      H: COLORS.woodHighlight,

      I: [58, 44, 35, 255],

      R: COLORS.red,
      Y: COLORS.yellow,
      B: COLORS.bookBlue,
      G: COLORS.bookGreen,

      Q: [236, 209, 165, 255],
    },
    "bookshelf"
  );
}

/**
 * 観葉植物
 *
 * 葉を1つの大きい円ではなく、
 * 複数枚に分けることでゲームらしくする。
 */
function generatePlant() {
  const grid = createGrid(20, 24);

  // 影
  fillEllipse(
    grid,
    10,
    21,
    6,
    2,
    "S"
  );

  // 茎
  fillRect(grid, 9, 8, 2, 8, "D");

  // 葉
  fillEllipse(grid, 10, 6, 5, 4, "G");
  fillEllipse(grid, 6, 7, 4, 4, "g");
  fillEllipse(grid, 14, 8, 4, 4, "G");

  fillEllipse(grid, 8, 3, 3, 3, "L");
  fillEllipse(grid, 13, 4, 3, 3, "g");

  fillEllipse(grid, 5, 11, 3, 3, "L");
  fillEllipse(grid, 15, 12, 3, 3, "L");

  // ハイライト
  fillRect(grid, 7, 4, 2, 1, "H");
  fillRect(grid, 12, 6, 2, 1, "H");

  // 鉢アウトライン
  fillRect(grid, 5, 15, 10, 7, "O");

  // 鉢
  fillRect(grid, 6, 16, 8, 5, "P");

  // 鉢上部
  fillRect(grid, 5, 15, 10, 2, "p");

  // 鉢ハイライト
  fillRect(grid, 7, 17, 2, 3, "Q");

  save(
    grid,
    {
      O: COLORS.outline,

      D: COLORS.greenDark,

      g: COLORS.green,
      G: COLORS.greenLight,
      L: COLORS.green,

      H: [175, 216, 126, 255],

      P: COLORS.pot,
      p: COLORS.potLight,
      Q: [232, 179, 125, 255],

      S: [85, 77, 67, 120],
    },
    "plant"
  );
}

/**
 * 受付カウンター
 *
 * 参考画像のように、
 * 「RECEPTION」というプレートを置ける形にする。
 */
function generateReceptionDesk() {
  const grid = createGrid(36, 24);

  // 影
  fillRect(grid, 3, 21, 30, 2, "S");

  // カウンター外枠
  fillRect(grid, 1, 7, 34, 14, "O");

  // 本体
  fillRect(grid, 2, 8, 32, 12, "D");

  // 上面
  fillRect(grid, 3, 5, 30, 5, "L");

  // 上面ハイライト
  fillRect(grid, 4, 5, 28, 1, "H");

  // 前面中央パネル
  fillRect(grid, 7, 11, 22, 8, "W");

  // パネル縁
  fillRect(grid, 8, 12, 20, 1, "L");

  // 看板
  fillRect(grid, 10, 13, 16, 4, "B");
  fillRect(grid, 11, 14, 14, 2, "b");

  // 看板に文字っぽいドット
  fillRect(grid, 12, 14, 1, 1, "Q");
  fillRect(grid, 14, 14, 2, 1, "Q");
  fillRect(grid, 17, 14, 1, 1, "Q");
  fillRect(grid, 19, 14, 2, 1, "Q");
  fillRect(grid, 22, 14, 2, 1, "Q");

  // 左右の柱
  fillRect(grid, 2, 17, 5, 4, "d");
  fillRect(grid, 29, 17, 5, 4, "d");

  // 卓上の呼び鈴
  fillRect(grid, 28, 3, 3, 2, "M");
  fillRect(grid, 29, 2, 1, 1, "m");

  save(
    grid,
    {
      O: COLORS.outline,

      D: COLORS.woodDark,
      d: [78, 50, 33, 255],

      W: COLORS.wood,
      L: COLORS.woodLight,
      H: COLORS.woodHighlight,

      B: COLORS.darkBlue,
      b: COLORS.blue,

      Q: COLORS.white,

      M: COLORS.metal,
      m: COLORS.metalLight,

      S: [79, 68, 58, 120],
    },
    "reception"
  );
}

/**
 * サーバーラック
 *
 * より本物のラックらしく、
 * 複数ユニット・LED・通気口を追加。
 */
function generateServerRack() {
  const grid = createGrid(20, 30);

  // 影
  fillRect(grid, 3, 28, 14, 2, "S");

  // 外枠
  fillRect(grid, 2, 1, 16, 28, "O");

  // 本体
  fillRect(grid, 3, 2, 14, 26, "D");

  // 左ハイライト
  fillRect(grid, 3, 2, 1, 25, "L");

  // 上部パネル
  fillRect(grid, 5, 4, 10, 3, "M");

  // サーバーユニット
  for (let y = 8; y <= 23; y += 4) {
    fillRect(grid, 5, y, 10, 3, "M");

    // パネル上ハイライト
    fillRect(grid, 6, y, 8, 1, "m");

    // LED
    fillRect(grid, 6, y + 1, 1, 1, "G");
    fillRect(grid, 8, y + 1, 1, 1, "Y");

    // 通気口
    fillRect(grid, 11, y + 1, 3, 1, "V");
  }

  // 下部吸気口
  fillRect(grid, 5, 25, 10, 2, "V");

  save(
    grid,
    {
      O: [30, 34, 38, 255],

      D: COLORS.metalDark,
      L: COLORS.metalLight,

      M: [58, 68, 77, 255],
      m: [103, 114, 121, 255],

      G: [81, 211, 117, 255],
      Y: [232, 184, 68, 255],

      V: [32, 39, 43, 255],

      S: [60, 55, 51, 120],
    },
    "server"
  );
}

/**
 * ホワイトボード
 *
 * PLAN / RESEARCHなどの部屋に配置。
 */
function generateWhiteboard() {
  const grid = createGrid(28, 22);

  // 脚
  fillRect(grid, 4, 16, 2, 6, "D");
  fillRect(grid, 22, 16, 2, 6, "D");

  // 外枠
  fillRect(grid, 2, 2, 24, 16, "O");

  // フレーム
  fillRect(grid, 3, 3, 22, 14, "F");

  // 白板
  fillRect(grid, 4, 4, 20, 12, "W");

  // 図っぽいライン
  fillRect(grid, 6, 7, 7, 1, "B");
  fillRect(grid, 8, 10, 10, 1, "R");

  fillRect(grid, 15, 6, 1, 6, "G");

  // ノード
  fillRect(grid, 6, 12, 3, 2, "Y");
  fillRect(grid, 17, 12, 3, 2, "B");

  save(
    grid,
    {
      O: COLORS.outline,

      F: COLORS.metal,
      D: COLORS.metalDark,

      W: COLORS.white,

      B: COLORS.bookBlue,
      R: COLORS.red,
      G: COLORS.bookGreen,
      Y: COLORS.yellow,
    },
    "whiteboard"
  );
}

/**
 * 小型キャビネット。
 *
 * 机だけが並ぶ単調なオフィスにならないようにする。
 */
function generateCabinet() {
  const grid = createGrid(18, 20);

  // 外枠
  fillRect(grid, 2, 2, 14, 17, "O");

  // 本体
  fillRect(grid, 3, 3, 12, 15, "D");

  // 上面
  fillRect(grid, 4, 1, 10, 3, "L");

  // 引き出し
  for (const y of [5, 9, 13]) {
    fillRect(grid, 4, y, 10, 3, "W");
    fillRect(grid, 5, y, 8, 1, "H");

    // 取手
    fillRect(grid, 8, y + 1, 2, 1, "M");
  }

  save(
    grid,
    {
      O: COLORS.outline,

      D: COLORS.woodDark,
      W: COLORS.wood,
      L: COLORS.woodLight,
      H: COLORS.woodHighlight,

      M: COLORS.metalDark,
    },
    "cabinet"
  );
}

/**
 * 会議テーブル。
 *
 * 会議室を個人デスクの並びと差別化するため、
 * PC付きデスクではなく「囲んで座る楕円テーブル+椅子」にする。
 */
function generateConferenceTable() {
  const grid = createGrid(28, 20);

  // 影
  fillRect(grid, 2, 16, 24, 2, "S");

  // 奥の椅子(背もたれ)
  fillRect(grid, 10, 1, 8, 5, "M");
  fillRect(grid, 11, 2, 6, 3, "m");

  // テーブル脚
  fillRect(grid, 4, 12, 3, 4, "D");
  fillRect(grid, 21, 12, 3, 4, "D");

  // 楕円天板
  fillEllipse(grid, 14, 9, 13, 6, "W");
  fillEllipse(grid, 14, 8, 12, 5, "L");

  // 天板の艶
  fillRect(grid, 5, 7, 18, 1, "H");

  // 資料っぽいドット
  fillRect(grid, 9, 9, 3, 2, "Q");
  fillRect(grid, 17, 9, 3, 2, "Q");

  save(
    grid,
    {
      O: COLORS.outline,

      D: COLORS.woodDark,
      W: COLORS.wood,
      L: COLORS.woodLight,
      H: COLORS.woodHighlight,

      M: COLORS.metalDark,
      m: COLORS.metal,

      Q: COLORS.white,

      S: [79, 68, 58, 120],
    },
    "conference_table"
  );
}

/**
 * モニターウォール。
 *
 * GitHub連携スペースを「受付」ではなく
 * commit/CI状況を映すダッシュボード壁にする。
 */
function generateMonitorWall() {
  const grid = createGrid(30, 18, "O");

  // フレーム本体
  fillRect(grid, 1, 1, 28, 16, "F");

  const screens = [
    [2, 2],
    [11, 2],
    [20, 2],
    [2, 10],
    [11, 10],
    [20, 10],
  ];

  for (const [x, y] of screens) {
    fillRect(grid, x, y, 8, 7, "S");
    fillRect(grid, x + 1, y + 1, 6, 2, "s");
    fillRect(grid, x + 1, y + 4, 4, 1, "g");
    fillRect(grid, x + 3, y + 5, 3, 1, "g");
  }

  save(
    grid,
    {
      O: [30, 34, 38, 255],
      F: COLORS.metalDark,

      S: COLORS.screenDark,
      s: COLORS.screenLight,

      g: COLORS.green,
    },
    "monitor_wall"
  );
}

/**
 * 休憩スペース用ソファ。
 *
 * 観葉植物だけだと公園のようになってしまうため、
 * 座って休めそうな家具を追加する。
 */
function generateCouch() {
  const grid = createGrid(26, 16);

  // 影
  fillRect(grid, 1, 13, 24, 2, "S");

  // 座面
  fillRect(grid, 2, 5, 22, 8, "C");

  // 座面ハイライト
  fillRect(grid, 3, 6, 20, 2, "c");

  // クッション継ぎ目
  fillRect(grid, 13, 5, 1, 8, "A");

  // 肘掛け
  fillRect(grid, 1, 2, 3, 10, "A");
  fillRect(grid, 22, 2, 3, 10, "A");

  // 背もたれ
  fillRect(grid, 3, 1, 20, 4, "A");
  fillRect(grid, 4, 2, 18, 2, "a");

  save(
    grid,
    {
      A: COLORS.darkBlue,
      a: COLORS.blue,
      C: COLORS.blue,
      c: COLORS.blueLight,

      S: [60, 55, 51, 120],
    },
    "couch"
  );
}

/**
 * 自動販売機。
 *
 * 休憩スペースをより「休憩スペースらしく」する家具。
 */
function generateVendingMachine() {
  const grid = createGrid(18, 28, "O");

  // 本体
  fillRect(grid, 1, 1, 16, 26, "B");

  // ガラス面
  fillRect(grid, 2, 2, 14, 15, "G");

  // 商品(色違いの小さい箱を並べる)
  const rows = [4, 9, 14];
  const productColors = ["R", "Y", "g"];
  let colorIdx = 0;

  for (const y of rows) {
    for (let x = 3; x < 15; x += 4) {
      const color = productColors[colorIdx % productColors.length];
      colorIdx += 1;
      fillRect(grid, x, y, 3, 4, color);
    }
  }

  // 取り出し口
  fillRect(grid, 3, 19, 12, 4, "D");

  // 操作パネル・コイン投入口
  fillRect(grid, 3, 24, 12, 2, "M");
  fillRect(grid, 13, 24, 2, 2, "m");

  save(
    grid,
    {
      O: [30, 34, 38, 255],
      B: COLORS.red,
      D: [40, 44, 48, 255],

      G: COLORS.screenDark,

      R: COLORS.red,
      Y: COLORS.yellow,
      g: COLORS.green,

      M: COLORS.metalDark,
      m: COLORS.metalLight,
    },
    "vending_machine"
  );
}

/**
 * 外壁の窓。
 *
 * 一番奥(row0)の壁に貼ることで、
 * 「実在するビルのオフィス」感を出す。
 * 什器と同じく部屋ごとのtintの影響を受けない固定色。
 */
function generateWindow() {
  const grid = createGrid(16, 14, "O");

  // 窓枠
  fillRect(grid, 1, 1, 14, 12, "F");

  // ガラス
  fillRect(grid, 2, 2, 12, 10, "G");

  // 空のグラデーション(上が明るい)
  fillRect(grid, 2, 2, 12, 4, "g");

  // 窓桟(十字)
  fillRect(grid, 7, 2, 2, 10, "F");
  fillRect(grid, 2, 7, 12, 1, "F");

  // 枠のハイライト
  fillRect(grid, 1, 1, 14, 1, "L");

  save(
    grid,
    {
      O: COLORS.outline,
      F: COLORS.frameLight,
      L: COLORS.white,

      G: COLORS.skyBlue,
      g: COLORS.skyBlueLight,
    },
    "window"
  );
}

export function generateFurniture() {
  generateDesk();
  generateBookshelf();
  generatePlant();
  generateReceptionDesk();
  generateServerRack();

  // オフィスの密度を上げる追加家具
  generateWhiteboard();
  generateCabinet();

  // 「会社らしさ」を強めるための追加家具
  generateConferenceTable();
  generateMonitorWall();
  generateCouch();
  generateVendingMachine();
  generateWindow();

  console.log(`
Generated furniture props:

- prop_desk.png
  モニター・キーボード・マグカップ付きデスク

- prop_bookshelf.png
  木製の大型本棚

- prop_plant.png
  観葉植物

- prop_reception.png
  ゲーム会社風受付カウンター

- prop_server.png
  LED付きサーバーラック

- prop_whiteboard.png
  設計・計画エリア用ホワイトボード

- prop_cabinet.png
  オフィス用キャビネット

- prop_conference_table.png
  会議室用の楕円テーブル

- prop_monitor_wall.png
  GitHub連携スペース用モニターウォール

- prop_couch.png
  休憩スペース用ソファ

- prop_vending_machine.png
  休憩スペース用自動販売機

- prop_window.png
  最奥の部屋の外壁に貼る窓
`);
}
