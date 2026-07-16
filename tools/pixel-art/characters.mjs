import {
  createGrid,
  fillRect,
  fillEllipse,
  gridToStrings,
  extractLayer,
  excludeLayer,
} from "./lib/shapes.mjs";

import {
  rasterizeGrid,
  writePng,
} from "./lib/raster.mjs";

const WIDTH = 24;
const HEIGHT = 30;
const SCALE = 5;

/**
 * 固定色。
 *
 * キャラクターごとの役割カラーは shirt layer のみ tint する。
 * 髪・肌・ズボン・靴は固定色。
 */
const DETAIL_PALETTE = {
  // outline
  o: [62, 47, 38, 255],

  // hair
  h: [72, 48, 31, 255],
  H: [106, 70, 40, 255],
  d: [49, 34, 25, 255],

  // skin
  s: [247, 199, 151, 255],
  S: [226, 166, 120, 255],
  l: [255, 220, 181, 255],

  // face
  e: [48, 39, 34, 255],
  m: [151, 80, 65, 255],

  // pants
  p: [55, 66, 83, 255],
  P: [38, 47, 61, 255],

  // shoes
  k: [45, 38, 34, 255],
};

/**
 * tintable shirt layer。
 *
 * 完全な白だけだと平坦になるため、
 * 明暗3段階に分けている。
 *
 * PIXI tint を掛けたときも
 * 立体感が残る。
 */
const BODY_PALETTE = {
  w: [255, 255, 255, 255],
  q: [224, 224, 224, 255],
  r: [190, 190, 190, 255],
};

/**
 * ポーズごとの腕・手の位置。
 *
 * hands だけではなく、
 * shoulder / arm を持たせる。
 */
const POSES = {
  idle: {
    leftArm: [4, 17, 3, 7],
    rightArm: [17, 17, 3, 7],

    leftHand: [4, 23],
    rightHand: [18, 23],
  },

  working: {
    leftArm: [7, 19, 3, 6],
    rightArm: [14, 19, 3, 6],

    leftHand: [8, 24],
    rightHand: [14, 24],
  },

  error: {
    leftArm: [2, 12, 4, 8],
    rightArm: [18, 12, 4, 8],

    leftHand: [2, 10],
    rightHand: [20, 10],
  },

  completed: {
    leftArm: [3, 9, 4, 8],
    rightArm: [17, 9, 4, 8],

    leftHand: [3, 7],
    rightHand: [19, 7],
  },
};

/**
 * 安全に1px描画。
 */
function setPixelSafe(grid, x, y, ch) {
  if (
    y >= 0 &&
    y < grid.length &&
    x >= 0 &&
    x < grid[0].length
  ) {
    grid[y][x] = ch;
  }
}

/**
 * キャラクター共通部分。
 *
 * 正面向きのチビキャラ。
 *
 * 頭身は
 *
 * 頭：約10px
 * 胴体：約10px
 * 脚：約7px
 *
 * 程度。
 */
function buildBaseGrid() {
  const grid = createGrid(
    WIDTH,
    HEIGHT
  );

  // ================================
  // 脚
  // ================================

  // 左脚
  fillRect(
    grid,
    7,
    23,
    4,
    5,
    "p"
  );

  // 右脚
  fillRect(
    grid,
    13,
    23,
    4,
    5,
    "p"
  );

  // 脚の影
  fillRect(
    grid,
    7,
    26,
    4,
    2,
    "P"
  );

  fillRect(
    grid,
    13,
    26,
    4,
    2,
    "P"
  );

  // 靴
  fillRect(
    grid,
    6,
    28,
    5,
    2,
    "k"
  );

  fillRect(
    grid,
    13,
    28,
    5,
    2,
    "k"
  );

  // ================================
  // 胴体
  // ================================

  // アウトライン
  fillRect(
    grid,
    5,
    15,
    14,
    9,
    "o"
  );

  // メインシャツ
  fillRect(
    grid,
    6,
    15,
    12,
    8,
    "b"
  );

  // 胸ハイライト用
  fillRect(
    grid,
    7,
    15,
    7,
    2,
    "c"
  );

  // 下側影
  fillRect(
    grid,
    6,
    21,
    12,
    2,
    "a"
  );

  // 首
  fillRect(
    grid,
    10,
    12,
    4,
    4,
    "s"
  );

  // ================================
  // 頭
  // ================================

  // 耳
  fillEllipse(
    grid,
    5,
    8,
    2,
    3,
    "S"
  );

  fillEllipse(
    grid,
    19,
    8,
    2,
    3,
    "S"
  );

  // 頭アウトライン
  fillEllipse(
    grid,
    12,
    7,
    8,
    7,
    "o"
  );

  // 顔
  fillEllipse(
    grid,
    12,
    8,
    7,
    6,
    "s"
  );

  // 顔ハイライト
  fillRect(
    grid,
    8,
    5,
    5,
    2,
    "l"
  );

  // ================================
  // 髪
  // ================================

  // 後頭部
  fillEllipse(
    grid,
    12,
    4,
    8,
    5,
    "h"
  );

  // 頭頂部ハイライト
  fillEllipse(
    grid,
    10,
    2,
    5,
    2,
    "H"
  );

  // 前髪
  fillRect(
    grid,
    6,
    5,
    4,
    3,
    "h"
  );

  fillRect(
    grid,
    9,
    4,
    4,
    4,
    "h"
  );

  fillRect(
    grid,
    13,
    5,
    5,
    3,
    "h"
  );

  // 髪の影
  fillRect(
    grid,
    5,
    7,
    2,
    4,
    "d"
  );

  fillRect(
    grid,
    17,
    7,
    2,
    4,
    "d"
  );

  // ================================
  // 顔パーツ
  // ================================

  // 目
  fillRect(
    grid,
    8,
    9,
    2,
    2,
    "e"
  );

  fillRect(
    grid,
    14,
    9,
    2,
    2,
    "e"
  );

  // 目の光
  setPixelSafe(
    grid,
    8,
    9,
    "l"
  );

  setPixelSafe(
    grid,
    14,
    9,
    "l"
  );

  // 鼻
  setPixelSafe(
    grid,
    12,
    11,
    "S"
  );

  // 口
  fillRect(
    grid,
    11,
    13,
    3,
    1,
    "m"
  );

  return grid;
}

/**
 * ポーズごとの腕を追加。
 */
function addPose(
  grid,
  poseName
) {
  const pose =
    POSES[poseName];

  if (!pose) {
    throw new Error(
      `Unknown pose: ${poseName}`
    );
  }

  // ================================
  // 左腕
  // ================================

  fillRect(
    grid,
    pose.leftArm[0] - 1,
    pose.leftArm[1] - 1,
    pose.leftArm[2] + 2,
    pose.leftArm[3] + 2,
    "o"
  );

  fillRect(
    grid,
    pose.leftArm[0],
    pose.leftArm[1],
    pose.leftArm[2],
    pose.leftArm[3],
    "b"
  );

  // ================================
  // 右腕
  // ================================

  fillRect(
    grid,
    pose.rightArm[0] - 1,
    pose.rightArm[1] - 1,
    pose.rightArm[2] + 2,
    pose.rightArm[3] + 2,
    "o"
  );

  fillRect(
    grid,
    pose.rightArm[0],
    pose.rightArm[1],
    pose.rightArm[2],
    pose.rightArm[3],
    "b"
  );

  // ================================
  // 手
  // ================================

  fillEllipse(
    grid,
    pose.leftHand[0],
    pose.leftHand[1],
    2,
    2,
    "s"
  );

  fillEllipse(
    grid,
    pose.rightHand[0],
    pose.rightHand[1],
    2,
    2,
    "s"
  );

  return grid;
}

/**
 * シャツの疑似陰影レイヤー。
 *
 * 元gridでは
 *
 * b = base
 * c = highlight
 * a = shadow
 *
 * として保持し、
 * 最終的に
 *
 * w/q/r
 *
 * に変換する。
 */
function buildBodyLayer(
  grid
) {
  const body =
    createGrid(
      WIDTH,
      HEIGHT
    );

  for (
    let y = 0;
    y < HEIGHT;
    y++
  ) {
    for (
      let x = 0;
      x < WIDTH;
      x++
    ) {
      const cell =
        grid[y][x];

      if (cell === "b") {
        body[y][x] =
          "w";
      }

      if (cell === "c") {
        body[y][x] =
          "q";
      }

      if (cell === "a") {
        body[y][x] =
          "r";
      }
    }
  }

  return body;
}

/**
 * shirt用記号を詳細レイヤーから除外。
 */
function buildDetailsLayer(
  grid
) {
  const details =
    createGrid(
      WIDTH,
      HEIGHT
    );

  for (
    let y = 0;
    y < HEIGHT;
    y++
  ) {
    for (
      let x = 0;
      x < WIDTH;
      x++
    ) {
      const cell =
        grid[y][x];

      if (
        cell !== "b" &&
        cell !== "c" &&
        cell !== "a"
      ) {
        details[y][x] =
          cell;
      }
    }
  }

  return details;
}

/**
 * キャラクター1ポーズ生成。
 */
function generatePose(
  pose
) {
  const combined =
    addPose(
      buildBaseGrid(),
      pose
    );

  const bodyGrid =
    buildBodyLayer(
      combined
    );

  const detailsGrid =
    buildDetailsLayer(
      combined
    );

  const bodyPng =
    rasterizeGrid(
      gridToStrings(
        bodyGrid
      ),
      BODY_PALETTE,
      {
        scale: SCALE,
      }
    );

  const detailsPng =
    rasterizeGrid(
      gridToStrings(
        detailsGrid
      ),
      DETAIL_PALETTE,
      {
        scale: SCALE,
      }
    );

  writePng(
    bodyPng,
    new URL(
      `../../apps/web/public/sprites/char_${pose}_body.png`,
      import.meta.url
    )
  );

  writePng(
    detailsPng,
    new URL(
      `../../apps/web/public/sprites/char_${pose}_details.png`,
      import.meta.url
    )
  );
}

/**
 * 全キャラクターポーズ生成。
 */
export function generateCharacters() {
  for (
    const pose of Object.keys(
      POSES
    )
  ) {
    generatePose(
      pose
    );
  }

  console.log(
    "Generated character sprites:",
    Object.keys(
      POSES
    ).join(
      ", "
    )
  );
}
