import { createGrid, fillRect, fillEllipse, gridToStrings } from "./lib/shapes.mjs";
import { rasterizeGrid, writePng } from "./lib/raster.mjs";

const WIDTH = 24;
const HEIGHT = 30;
const SCALE = 5;

/**
 * 固定色(非tint)。役割カラーは shirt(body)レイヤーのみ tint する。
 * 髪色 h/H/d はバリアントごとに上書きされる。
 */
const DETAIL_PALETTE = {
  // outline
  o: [62, 47, 38, 255],
  // hair (バリアントで差し替え)
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
  // glasses
  G: [45, 48, 58, 255],
};

/** tintable shirt layer(白の明暗3段。PIXI tint 後も立体感が残る)。 */
const BODY_PALETTE = {
  w: [255, 255, 255, 255],
  q: [224, 224, 224, 255],
  r: [190, 190, 190, 255],
};

/**
 * STEP7: 社員IDでシードされる外見バリアント。髪型・髪色・メガネ・パーカーの組で
 * 5種類、どれもシルエットで見分けがつくようにする。
 */
const VARIANTS = [
  { id: 0, hair: "short", glasses: false, hoodie: false, hairColor: { h: [72, 48, 31, 255], H: [106, 70, 40, 255], d: [49, 34, 25, 255] } },
  { id: 1, hair: "long", glasses: false, hoodie: false, hairColor: { h: [43, 38, 46, 255], H: [76, 68, 84, 255], d: [28, 25, 32, 255] } },
  { id: 2, hair: "short", glasses: true, hoodie: false, hairColor: { h: [58, 42, 30, 255], H: [88, 64, 42, 255], d: [38, 28, 20, 255] } },
  { id: 3, hair: "bob", glasses: false, hoodie: false, hairColor: { h: [142, 74, 40, 255], H: [178, 104, 60, 255], d: [104, 52, 28, 255] } },
  { id: 4, hair: "spiky", glasses: false, hoodie: true, hairColor: { h: [196, 158, 80, 255], H: [224, 192, 110, 255], d: [150, 116, 56, 255] } },
];

/** ポーズごとの腕・手の位置。walk1/walk2 は歩行サイクルの2コマ(腕を前後にスイング)。 */
const POSES = {
  idle: { leftArm: [4, 17, 3, 7], rightArm: [17, 17, 3, 7], leftHand: [4, 23], rightHand: [18, 23] },
  working: { leftArm: [7, 19, 3, 6], rightArm: [14, 19, 3, 6], leftHand: [8, 24], rightHand: [14, 24] },
  error: { leftArm: [2, 12, 4, 8], rightArm: [18, 12, 4, 8], leftHand: [2, 10], rightHand: [20, 10] },
  completed: { leftArm: [3, 9, 4, 8], rightArm: [17, 9, 4, 8], leftHand: [3, 7], rightHand: [19, 7] },
  walk1: { leftArm: [4, 15, 3, 7], rightArm: [17, 19, 3, 6], leftHand: [4, 21], rightHand: [18, 24], legPhase: 1 },
  walk2: { leftArm: [4, 19, 3, 6], rightArm: [17, 15, 3, 7], leftHand: [4, 24], rightHand: [18, 21], legPhase: 2 },
};

/**
 * 脚の描画。legPhase 0 = 直立(両脚接地)、1 = 左脚を上げる、2 = 右脚を上げる。
 * カイロソフト風の2コマ歩行: 上げた脚は1px短く+靴を1px上げ、接地脚はそのまま。
 */
function drawLegs(grid, legPhase = 0) {
  const leftUp = legPhase === 1;
  const rightUp = legPhase === 2;

  // 左脚
  fillRect(grid, 7, 23, 4, leftUp ? 4 : 5, "p");
  fillRect(grid, 7, 26, 4, leftUp ? 1 : 2, "P");
  fillRect(grid, 6, leftUp ? 27 : 28, 5, 2, "k");
  // 右脚
  fillRect(grid, 13, 23, 4, rightUp ? 4 : 5, "p");
  fillRect(grid, 13, 26, 4, rightUp ? 1 : 2, "P");
  fillRect(grid, 13, rightUp ? 27 : 28, 5, 2, "k");
}

function setPixelSafe(grid, x, y, ch) {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = ch;
}

/** 正面向きの髪型(頭部の上に重ねる)。 */
function applyHairFront(grid, style) {
  // 後頭部シルエット(全スタイル共通のベース)
  fillEllipse(grid, 12, 4, 8, 5, "h");
  fillEllipse(grid, 10, 2, 5, 2, "H");

  if (style === "short") {
    fillRect(grid, 6, 5, 4, 3, "h");
    fillRect(grid, 9, 4, 4, 4, "h");
    fillRect(grid, 13, 5, 5, 3, "h");
    fillRect(grid, 5, 7, 2, 4, "d");
    fillRect(grid, 17, 7, 2, 4, "d");
  } else if (style === "long") {
    // 前髪 + 両サイドを肩まで流す
    fillRect(grid, 6, 5, 12, 3, "h");
    fillRect(grid, 4, 7, 3, 11, "h");
    fillRect(grid, 17, 7, 3, 11, "h");
    fillRect(grid, 4, 15, 3, 3, "d");
    fillRect(grid, 17, 15, 3, 3, "d");
  } else if (style === "bob") {
    // 丸いボブ: まっすぐな前髪と頬までのサイド
    fillRect(grid, 5, 4, 14, 4, "h");
    fillRect(grid, 5, 8, 2, 5, "h");
    fillRect(grid, 17, 8, 2, 5, "h");
    fillRect(grid, 5, 11, 2, 2, "d");
    fillRect(grid, 17, 11, 2, 2, "d");
    fillRect(grid, 6, 4, 7, 1, "H");
  } else if (style === "spiky") {
    // ツンツン頭: 上に3つのスパイク
    fillRect(grid, 6, 5, 4, 2, "h");
    fillRect(grid, 14, 5, 4, 2, "h");
    fillRect(grid, 6, 1, 2, 3, "h");
    fillRect(grid, 11, 0, 2, 4, "h");
    fillRect(grid, 16, 1, 2, 3, "h");
    fillRect(grid, 5, 7, 2, 3, "d");
    fillRect(grid, 17, 7, 2, 3, "d");
  }
}

/** 後ろ向きの髪型(顔なし、髪で頭全体を覆う)。 */
function applyHairBack(grid, style) {
  fillEllipse(grid, 12, 7, 7, 6.5, "h");
  fillEllipse(grid, 12, 4, 7, 4, "H");
  fillRect(grid, 11, 2, 2, 11, "d");

  if (style === "long") {
    // 背中まで髪が流れる
    fillRect(grid, 6, 12, 12, 6, "h");
    fillRect(grid, 7, 18, 10, 2, "d");
  } else if (style === "bob") {
    fillRect(grid, 5, 8, 14, 4, "h");
    fillRect(grid, 5, 12, 14, 1, "d");
  } else if (style === "spiky") {
    fillRect(grid, 6, 1, 2, 3, "h");
    fillRect(grid, 11, 0, 2, 4, "h");
    fillRect(grid, 16, 1, 2, 3, "h");
  }
}

/** メガネ(正面のみ)。目の位置(8,9)-(9,10) / (14,9)-(15,10) を囲むリム。 */
function applyGlasses(grid) {
  for (const lx of [7, 13]) {
    fillRect(grid, lx, 8, 4, 1, "G");
    fillRect(grid, lx, 11, 4, 1, "G");
    fillRect(grid, lx, 9, 1, 2, "G");
    fillRect(grid, lx + 3, 9, 1, 2, "G");
  }
  fillRect(grid, 11, 9, 2, 1, "G");
  setPixelSafe(grid, 6, 9, "G");
  setPixelSafe(grid, 17, 9, "G");
}

/** パーカーのフード(tintableな shirt色で描くので役割カラーに染まる)。 */
function applyHoodieFront(grid) {
  // 首まわりのフード襟
  fillRect(grid, 5, 13, 14, 3, "o");
  fillRect(grid, 6, 13, 12, 2, "b");
  fillRect(grid, 8, 15, 8, 1, "a");
  // ドローストリング
  setPixelSafe(grid, 10, 16, "e");
  setPixelSafe(grid, 13, 16, "e");
}

function applyHoodieBack(grid) {
  // 背中に垂れたフード
  fillRect(grid, 6, 13, 12, 4, "o");
  fillRect(grid, 7, 13, 10, 3, "b");
  fillRect(grid, 8, 16, 8, 1, "a");
}

/**
 * キャラクター共通部分(正面)。チビキャラ: 頭約10px / 胴体約10px / 脚約7px ≒ 2.5頭身。
 */
function buildBaseGrid(variant, legPhase = 0) {
  const grid = createGrid(WIDTH, HEIGHT);

  // 脚
  drawLegs(grid, legPhase);

  // 胴体
  fillRect(grid, 5, 15, 14, 9, "o");
  fillRect(grid, 6, 15, 12, 8, "b");
  fillRect(grid, 7, 15, 7, 2, "c");
  fillRect(grid, 6, 21, 12, 2, "a");

  // 首
  fillRect(grid, 10, 12, 4, 4, "s");

  // 耳
  fillEllipse(grid, 5, 8, 2, 3, "S");
  fillEllipse(grid, 19, 8, 2, 3, "S");

  // 頭
  fillEllipse(grid, 12, 7, 8, 7, "o");
  fillEllipse(grid, 12, 8, 7, 6, "s");
  fillRect(grid, 8, 5, 5, 2, "l");

  // 髪
  applyHairFront(grid, variant.hair);

  // 顔パーツ
  fillRect(grid, 8, 9, 2, 2, "e");
  fillRect(grid, 14, 9, 2, 2, "e");
  setPixelSafe(grid, 8, 9, "l");
  setPixelSafe(grid, 14, 9, "l");
  setPixelSafe(grid, 12, 11, "S");
  fillRect(grid, 11, 13, 3, 1, "m");

  if (variant.glasses) applyGlasses(grid);
  if (variant.hoodie) applyHoodieFront(grid);

  return grid;
}

/** キャラクター共通部分(後ろ向き)。 */
function buildBackGrid(variant, legPhase = 0) {
  const grid = createGrid(WIDTH, HEIGHT);

  // 脚(正面と同じ)
  drawLegs(grid, legPhase);

  // 胴体(背中側)
  fillRect(grid, 5, 15, 14, 9, "o");
  fillRect(grid, 6, 15, 12, 8, "b");
  fillRect(grid, 9, 15, 6, 2, "c");
  fillRect(grid, 6, 21, 12, 2, "a");

  // 首
  fillRect(grid, 10, 12, 4, 4, "s");

  // 後頭部
  fillEllipse(grid, 12, 7, 8, 7, "o");
  applyHairBack(grid, variant.hair);

  if (variant.hoodie) applyHoodieBack(grid);

  return grid;
}

/** ポーズごとの腕を追加。 */
function addPose(grid, poseName) {
  const pose = POSES[poseName];
  if (!pose) throw new Error(`Unknown pose: ${poseName}`);

  for (const arm of [pose.leftArm, pose.rightArm]) {
    fillRect(grid, arm[0] - 1, arm[1] - 1, arm[2] + 2, arm[3] + 2, "o");
    fillRect(grid, arm[0], arm[1], arm[2], arm[3], "b");
  }
  fillEllipse(grid, pose.leftHand[0], pose.leftHand[1], 2, 2, "s");
  fillEllipse(grid, pose.rightHand[0], pose.rightHand[1], 2, 2, "s");
  return grid;
}

/** shirt疑似陰影(b/c/a)を tintable レイヤー(w/q/r)へ。 */
function buildBodyLayer(grid) {
  const body = createGrid(WIDTH, HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const cell = grid[y][x];
      if (cell === "b") body[y][x] = "w";
      if (cell === "c") body[y][x] = "q";
      if (cell === "a") body[y][x] = "r";
    }
  }
  return body;
}

/** shirt用記号以外を固定色レイヤーへ。 */
function buildDetailsLayer(grid) {
  const details = createGrid(WIDTH, HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const cell = grid[y][x];
      if (cell !== "b" && cell !== "c" && cell !== "a") details[y][x] = cell;
    }
  }
  return details;
}

const FACINGS = ["front", "back"];

function generatePose(variant, pose, facing) {
  const legPhase = POSES[pose]?.legPhase ?? 0;
  const baseGrid = facing === "back" ? buildBackGrid(variant, legPhase) : buildBaseGrid(variant, legPhase);
  const combined = addPose(baseGrid, pose);
  const bodyGrid = buildBodyLayer(combined);
  const detailsGrid = buildDetailsLayer(combined);

  const palette = { ...DETAIL_PALETTE, ...variant.hairColor };
  const bodyPng = rasterizeGrid(gridToStrings(bodyGrid), BODY_PALETTE, { scale: SCALE });
  const detailsPng = rasterizeGrid(gridToStrings(detailsGrid), palette, { scale: SCALE });

  const prefix = `char_v${variant.id}_${pose}_${facing}`;
  writePng(bodyPng, new URL(`../../apps/web/public/sprites/${prefix}_body.png`, import.meta.url));
  writePng(detailsPng, new URL(`../../apps/web/public/sprites/${prefix}_details.png`, import.meta.url));
}

export function generateCharacters() {
  for (const variant of VARIANTS) {
    for (const pose of Object.keys(POSES)) {
      for (const facing of FACINGS) {
        generatePose(variant, pose, facing);
      }
    }
  }
  console.log(
    `Generated character sprites: ${VARIANTS.length} variants x ${Object.keys(POSES).length} poses x ${FACINGS.length} facings`
  );
}
