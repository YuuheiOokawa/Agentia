"use client";

import { Fragment } from "react";
import { Stage, Container, Graphics, Sprite, Text } from "@pixi/react";
import { TextMetrics, TextStyle, type Graphics as PixiGraphics } from "pixi.js";
import { useOfficeStore } from "@/stores/office-store";
import { lightenColor, shadeColor } from "@/lib/color";
import { AREA_ACCESSORY, AREA_FURNITURE, areaSlots, PHASE2_AREA_LAYOUT, type AreaLayout } from "../map/map";
import {
  APRON_TILES,
  GRID_COLS,
  GRID_ROWS,
  isoDepth,
  isoToScreen,
  NORTH_WALL_SKEW_Y,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  PARAPET_H,
  WALL_H,
} from "../map/iso";
import { CharacterSprite } from "../characters/CharacterSprite";
import { FURNITURE_TEXTURES, WINDOW_TEXTURE } from "../pixel-assets";

const AREA_LABEL_STYLE = new TextStyle({ fontSize: 12, fontWeight: "700", fill: 0xffffff });
const STEP_LABEL_STYLE = new TextStyle({ fontSize: 11, fontWeight: "700", fill: 0xffffff, stroke: 0x1a2b45, strokeThickness: 3 });
const STEP_NUMBER_STYLE = new TextStyle({ fontSize: 11, fontWeight: "700", fill: 0xffffff });

/** The new isometric voxel props are drawn on smaller grids than the old flat billboards. */
const FURNITURE_SCALE = 0.5;
const WINDOW_SCALE = 0.26;

/** Traces one floor tile's diamond at world tile (tx, ty). */
function tileDiamond(g: PixiGraphics, tx: number, ty: number): void {
  const top = isoToScreen(tx, ty);
  const right = isoToScreen(tx + 1, ty);
  const bottom = isoToScreen(tx + 1, ty + 1);
  const left = isoToScreen(tx, ty + 1);
  g.drawPolygon([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y]);
}

/** Neutral checkerboard under the whole grid, ringed by a grey sidewalk apron, with the building's
 * soft drop shadow cast onto the apron along its south/east faces - grounds the diorama like the
 * reference instead of floating it on the page background. */
function BaseFloor() {
  const draw = (g: PixiGraphics) => {
    g.clear();
    for (let ty = -1; ty < GRID_ROWS + APRON_TILES; ty += 1) {
      for (let tx = -APRON_TILES; tx < GRID_COLS + APRON_TILES; tx += 1) {
        const inside = tx >= 0 && tx < GRID_COLS && ty >= 0 && ty < GRID_ROWS;
        if (inside) g.beginFill((tx + ty) % 2 === 0 ? 0xd9d6cf : 0xcfccc4);
        else g.beginFill((tx + ty) % 2 === 0 ? 0xe0e0de : 0xd8d8d6);
        tileDiamond(g, tx, ty);
        g.endFill();
      }
    }

    // Building shadow onto the apron (south face, then east face).
    const s1 = isoToScreen(0, GRID_ROWS);
    const s2 = isoToScreen(GRID_COLS, GRID_ROWS);
    const s3 = isoToScreen(GRID_COLS, GRID_ROWS + 0.8);
    const s4 = isoToScreen(0, GRID_ROWS + 0.8);
    g.beginFill(0x000000, 0.1);
    g.drawPolygon([s1.x, s1.y, s2.x, s2.y, s3.x, s3.y, s4.x, s4.y]);
    g.endFill();
    const e1 = isoToScreen(GRID_COLS, 0);
    const e2 = isoToScreen(GRID_COLS, GRID_ROWS);
    const e3 = isoToScreen(GRID_COLS + 0.8, GRID_ROWS);
    const e4 = isoToScreen(GRID_COLS + 0.8, 0);
    g.beginFill(0x000000, 0.1);
    g.drawPolygon([e1.x, e1.y, e2.x, e2.y, e3.x, e3.y, e4.x, e4.y]);
    g.endFill();

    // Entrance doormat centered on the building's front edge.
    const mat = isoToScreen(13.5, GRID_ROWS + 0.55);
    g.beginFill(0x9b958d);
    g.drawPolygon([mat.x - 20, mat.y, mat.x, mat.y - 10, mat.x + 20, mat.y, mat.x, mat.y + 10]);
    g.endFill();
  };
  return <Graphics zIndex={-1000} draw={draw} />;
}

/** A room's colored checker floor (two lightened shades of its accent color), with a soft ambient-
 * occlusion strip along the two back walls so the floor visibly "meets" them - the classic
 * Kairosoft interior shading cue. */
function RoomFloor({ area }: { area: AreaLayout }) {
  const shadeA = lightenColor(area.color, 0.76);
  const shadeB = lightenColor(area.color, 0.68);
  const draw = (g: PixiGraphics) => {
    g.clear();
    for (let ty = area.gy; ty < area.gy + area.gh; ty += 1) {
      for (let tx = area.gx; tx < area.gx + area.gw; tx += 1) {
        g.beginFill((tx + ty) % 2 === 0 ? shadeA : shadeB);
        tileDiamond(g, tx, ty);
        g.endFill();
      }
    }

    const n1 = isoToScreen(area.gx, area.gy);
    const n2 = isoToScreen(area.gx + area.gw, area.gy);
    const n3 = isoToScreen(area.gx + area.gw, area.gy + 0.45);
    const n4 = isoToScreen(area.gx, area.gy + 0.45);
    g.beginFill(0x000000, 0.09);
    g.drawPolygon([n1.x, n1.y, n2.x, n2.y, n3.x, n3.y, n4.x, n4.y]);
    g.endFill();
    const w1 = isoToScreen(area.gx, area.gy);
    const w2 = isoToScreen(area.gx, area.gy + area.gh);
    const w3 = isoToScreen(area.gx + 0.45, area.gy + area.gh);
    const w4 = isoToScreen(area.gx + 0.45, area.gy);
    g.beginFill(0x000000, 0.09);
    g.drawPolygon([w1.x, w1.y, w2.x, w2.y, w3.x, w3.y, w4.x, w4.y]);
    g.endFill();

    // Daylight pools slanting in from the exterior windows (topmost band only).
    if (area.row === 0) {
      for (const wx of [area.gx + 1, area.gx + area.gw - 2.4]) {
        const l1 = isoToScreen(wx - 0.1, area.gy);
        const l2 = isoToScreen(wx + 1.3, area.gy);
        const l3 = isoToScreen(wx + 1.9, area.gy + 1.7);
        const l4 = isoToScreen(wx + 0.5, area.gy + 1.7);
        g.beginFill(0xffffff, 0.12);
        g.drawPolygon([l1.x, l1.y, l2.x, l2.y, l3.x, l3.y, l4.x, l4.y]);
        g.endFill();
      }
    }
  };
  return <Graphics zIndex={-500} draw={draw} />;
}

/**
 * Room walls as per-tile segments so painter's sorting works: a character standing in front of a
 * wall segment (greater world depth) draws over it, one standing behind it (in a corridor/other
 * room) is hidden by it. North/west walls are full height, front/east walls are low parapets so
 * every room reads as an open box you look into - same construction as the reference image.
 */
function RoomWalls({ area }: { area: AreaLayout }) {
  // Noticeably more saturated than the floor (lighten 0.45 vs 0.68-0.76) so wall faces read as
  // vertical surfaces instead of blending into the floor they sit on.
  const base = lightenColor(area.color, 0.45);
  const north = base;
  const west = shadeColor(base, 0.75);
  const parapet = shadeColor(base, 0.9);
  const parapetSide = shadeColor(base, 0.72);
  /** Bright top face showing the wall's thickness - what makes walls read as solid, not paper. */
  const cap = lightenColor(base, 0.72);

  /** Wall/parapet thickness in tiles, extruded outward from the room. */
  const T = 0.14;
  const TP = 0.1;

  const segments: Array<{ key: string; z: number; draw: (g: PixiGraphics) => void }> = [];

  for (let tx = area.gx; tx < area.gx + area.gw; tx += 1) {
    const p1 = isoToScreen(tx, area.gy);
    const p2 = isoToScreen(tx + 1, area.gy);
    const c1 = isoToScreen(tx, area.gy - T);
    const c2 = isoToScreen(tx + 1, area.gy - T);
    segments.push({
      key: `n${tx}`,
      z: isoDepth(tx + 0.5, area.gy) - 0.1,
      draw: (g) => {
        g.clear();
        g.beginFill(north);
        g.drawPolygon([p1.x, p1.y, p2.x, p2.y, p2.x, p2.y - WALL_H, p1.x, p1.y - WALL_H]);
        g.endFill();
        g.beginFill(cap);
        g.drawPolygon([c1.x, c1.y - WALL_H, c2.x, c2.y - WALL_H, p2.x, p2.y - WALL_H, p1.x, p1.y - WALL_H]);
        g.endFill();
      },
    });

    const q1 = isoToScreen(tx, area.gy + area.gh);
    const q2 = isoToScreen(tx + 1, area.gy + area.gh);
    const d1 = isoToScreen(tx, area.gy + area.gh + TP);
    const d2 = isoToScreen(tx + 1, area.gy + area.gh + TP);
    segments.push({
      key: `s${tx}`,
      z: isoDepth(tx + 0.5, area.gy + area.gh) - 0.1,
      draw: (g) => {
        g.clear();
        g.beginFill(parapet);
        g.drawPolygon([d1.x, d1.y, d2.x, d2.y, d2.x, d2.y - PARAPET_H, d1.x, d1.y - PARAPET_H]);
        g.endFill();
        g.beginFill(cap);
        g.drawPolygon([q1.x, q1.y - PARAPET_H, q2.x, q2.y - PARAPET_H, d2.x, d2.y - PARAPET_H, d1.x, d1.y - PARAPET_H]);
        g.endFill();
      },
    });
  }

  for (let ty = area.gy; ty < area.gy + area.gh; ty += 1) {
    const p1 = isoToScreen(area.gx, ty);
    const p2 = isoToScreen(area.gx, ty + 1);
    const c1 = isoToScreen(area.gx - T, ty);
    const c2 = isoToScreen(area.gx - T, ty + 1);
    segments.push({
      key: `w${ty}`,
      z: isoDepth(area.gx, ty + 0.5) - 0.1,
      draw: (g) => {
        g.clear();
        g.beginFill(west);
        g.drawPolygon([p1.x, p1.y, p2.x, p2.y, p2.x, p2.y - WALL_H, p1.x, p1.y - WALL_H]);
        g.endFill();
        g.beginFill(cap);
        g.drawPolygon([c1.x, c1.y - WALL_H, c2.x, c2.y - WALL_H, p2.x, p2.y - WALL_H, p1.x, p1.y - WALL_H]);
        g.endFill();
      },
    });

    const q1 = isoToScreen(area.gx + area.gw, ty);
    const q2 = isoToScreen(area.gx + area.gw, ty + 1);
    const d1 = isoToScreen(area.gx + area.gw + TP, ty);
    const d2 = isoToScreen(area.gx + area.gw + TP, ty + 1);
    segments.push({
      key: `e${ty}`,
      z: isoDepth(area.gx + area.gw, ty + 0.5) - 0.1,
      draw: (g) => {
        g.clear();
        g.beginFill(parapetSide);
        g.drawPolygon([d1.x, d1.y, d2.x, d2.y, d2.x, d2.y - PARAPET_H, d1.x, d1.y - PARAPET_H]);
        g.endFill();
        g.beginFill(cap);
        g.drawPolygon([q1.x, q1.y - PARAPET_H, q2.x, q2.y - PARAPET_H, d2.x, d2.y - PARAPET_H, d1.x, d1.y - PARAPET_H]);
        g.endFill();
      },
    });
  }

  // Corner cap where the two full-height back walls meet, closing the top face neatly.
  {
    const k1 = isoToScreen(area.gx - T, area.gy - T);
    const k2 = isoToScreen(area.gx, area.gy - T);
    const k3 = isoToScreen(area.gx, area.gy);
    const k4 = isoToScreen(area.gx - T, area.gy);
    segments.push({
      key: "nw-cap",
      z: isoDepth(area.gx, area.gy) - 0.1,
      draw: (g) => {
        g.clear();
        g.beginFill(cap);
        g.drawPolygon([k1.x, k1.y - WALL_H, k2.x, k2.y - WALL_H, k3.x, k3.y - WALL_H, k4.x, k4.y - WALL_H]);
        g.endFill();
      },
    });
  }

  return (
    <>
      {segments.map((s) => (
        <Graphics key={s.key} zIndex={s.z} draw={s.draw} />
      ))}
    </>
  );
}

/** Windows skewed onto the back walls of the topmost band (the building's exterior wall). */
function ExteriorWindows({ area }: { area: AreaLayout }) {
  if (area.row !== 0) return null;
  const positions = [area.gx + 1, area.gx + area.gw - 2.4];
  return (
    <>
      {positions.map((tx, i) => {
        const base = isoToScreen(tx, area.gy);
        return (
          <Sprite
            key={i}
            texture={WINDOW_TEXTURE}
            x={base.x}
            y={base.y - 9}
            anchor={{ x: 0, y: 1 }}
            skew={{ x: 0, y: NORTH_WALL_SKEW_Y }}
            scale={{ x: WINDOW_SCALE, y: WINDOW_SCALE }}
            zIndex={isoDepth(tx + 0.5, area.gy) - 0.05}
          />
        );
      })}
    </>
  );
}

/** Furniture at each desk slot, depth-sorted with everything else; a grounding shadow per prop. */
function AreaFurniture({ area }: { area: AreaLayout }) {
  const furniture = AREA_FURNITURE[area.areaId];
  const props = Array.isArray(furniture) ? furniture : [furniture];
  return (
    <>
      {areaSlots(area.areaId).map((slot, i) => {
        const screen = isoToScreen(slot.x, slot.y);
        const z = isoDepth(slot.x, slot.y);
        const drawShadow = (g: PixiGraphics) => {
          g.clear();
          g.beginFill(0x000000, 0.16);
          g.drawEllipse(screen.x, screen.y + 2, 16, 5);
          g.endFill();
        };
        // Direct siblings of the sortable world container (a wrapper Container would collapse
        // their depth to zIndex 0 and break occlusion against characters).
        return (
          <Fragment key={i}>
            <Graphics zIndex={z - 0.01} draw={drawShadow} />
            <Sprite
              texture={FURNITURE_TEXTURES[props[i % props.length]!]}
              x={screen.x}
              y={screen.y + 4}
              anchor={{ x: 0.5, y: 1 }}
              scale={{ x: FURNITURE_SCALE, y: FURNITURE_SCALE }}
              zIndex={z}
            />
          </Fragment>
        );
      })}
    </>
  );
}

/** One extra prop parked against the room's back wall. */
function AreaAccessory({ area }: { area: AreaLayout }) {
  const prop = AREA_ACCESSORY[area.areaId];
  if (!prop) return null;
  const wx = area.gx + area.gw - 1.2;
  const wy = area.gy + 0.7;
  const screen = isoToScreen(wx, wy);
  return (
    <Sprite
      texture={FURNITURE_TEXTURES[prop]}
      x={screen.x}
      y={screen.y + 4}
      anchor={{ x: 0.5, y: 1 }}
      scale={{ x: FURNITURE_SCALE * 0.85, y: FURNITURE_SCALE * 0.85 }}
      zIndex={isoDepth(wx, wy)}
    />
  );
}

/** A potted plant in the front-left corner of most rooms - cheap interior density (the tech rooms
 * and the break room, which already cycles plants, are left out). */
const PLANTED_ROOMS = new Set(["library", "research_space", "meeting_room", "pm_space", "dev_floor", "personal_desk", "terminal_room", "qa_room", "deploy_area"]);

function RoomPlant({ area }: { area: AreaLayout }) {
  if (!PLANTED_ROOMS.has(area.areaId)) return null;
  const wx = area.gx + 0.75;
  const wy = area.gy + area.gh - 0.75;
  const screen = isoToScreen(wx, wy);
  return (
    <Sprite
      texture={FURNITURE_TEXTURES.plant}
      x={screen.x}
      y={screen.y + 3}
      anchor={{ x: 0.5, y: 1 }}
      scale={{ x: 0.26, y: 0.26 }}
      zIndex={isoDepth(wx, wy)}
    />
  );
}

/** Planting on the sidewalk apron around the building (world positions outside the grid). */
const EXTERIOR_TREES = [
  { wx: -1.2, wy: 4 },
  { wx: -1.2, wy: 11 },
  { wx: GRID_COLS + 1.2, wy: 6 },
  { wx: GRID_COLS + 1.2, wy: 13 },
  { wx: 6, wy: GRID_ROWS + 0.9 },
  { wx: 21, wy: GRID_ROWS + 0.9 },
] as const;

function ExteriorTrees() {
  return (
    <>
      {EXTERIOR_TREES.map((tree, i) => {
        const screen = isoToScreen(tree.wx, tree.wy);
        return (
          <Sprite
            key={i}
            texture={FURNITURE_TEXTURES.plant}
            x={screen.x}
            y={screen.y + 3}
            anchor={{ x: 0.5, y: 1 }}
            scale={{ x: 0.5, y: 0.5 }}
            zIndex={isoDepth(tree.wx, tree.wy)}
          />
        );
      })}
    </>
  );
}

const ENTRANCE_SIGN_STYLE = new TextStyle({ fontSize: 13, fontWeight: "700", fill: 0xffffff, letterSpacing: 1 });

/** "Agentia" sign over the building's front entrance, like the reference's canopy. */
function EntranceSign() {
  const anchor = isoToScreen(13.5, GRID_ROWS);
  const metrics = TextMetrics.measureText("Agentia", ENTRANCE_SIGN_STYLE);
  const w = metrics.width + 24;
  const h = metrics.height + 8;
  const x = anchor.x - w / 2;
  const y = anchor.y - PARAPET_H - h - 6;
  const draw = (g: PixiGraphics) => {
    g.clear();
    g.beginFill(0x4a3b2f, 0.97);
    g.drawRoundedRect(x, y, w, h, 4);
    g.endFill();
    g.beginFill(0x4a3b2f, 0.97);
    g.drawRect(anchor.x - 2, y + h, 4, 8);
    g.endFill();
  };
  return (
    <>
      <Graphics draw={draw} />
      <Text text="Agentia" x={anchor.x} y={y + 4} anchor={{ x: 0.5, y: 0 }} style={ENTRANCE_SIGN_STYLE} />
    </>
  );
}

/** Kairosoft-style name plate floating over each room. Anchored at the room's own center (not its
 * back wall, whose screen position is ambiguous between the room and its rear neighbor in iso),
 * and clamped to the stage so edge rooms' plates never clip off-screen. */
function RoomLabel({ area }: { area: AreaLayout }) {
  const text = `${area.icon} ${area.name}`;
  const metrics = TextMetrics.measureText(text, AREA_LABEL_STYLE);
  const anchor = isoToScreen(area.gx + area.gw / 2, area.gy + area.gh / 2);
  const w = metrics.width + 16;
  const h = metrics.height + 8;
  const x = Math.min(Math.max(anchor.x - w / 2, 4), OFFICE_WIDTH - w - 4);
  const y = anchor.y - 44;
  const draw = (g: PixiGraphics) => {
    g.clear();
    g.beginFill(shadeColor(area.color, 0.45), 0.95);
    g.drawRoundedRect(x, y, w, h, 6);
    g.endFill();
  };
  return (
    <>
      <Graphics draw={draw} />
      <Text text={text} x={x + 8} y={y + 4} style={AREA_LABEL_STYLE} />
    </>
  );
}

/** The five numbered workflow steps from the reference image, laid along the walk corridors. */
const FLOW_STEPS = [
  { n: "1", label: "計画・設計", wx: 8.5, wy: 4.5 },
  { n: "2", label: "開発・実装", wx: 4, wy: 10.5 },
  { n: "3", label: "テスト・検証", wx: 6, wy: 15.5 },
  { n: "4", label: "レビュー・QA", wx: 15, wy: 15.5 },
  { n: "5", label: "完了・リリース", wx: 19.5, wy: 17.4 },
] as const;

const FLOW_LINES = [
  { from: { x: 3, y: 4.5 }, to: { x: 24.5, y: 4.5 } },
  { from: { x: 3, y: 10.5 }, to: { x: 24.5, y: 10.5 } },
  { from: { x: 3, y: 15.5 }, to: { x: 24.5, y: 15.5 } },
  { from: { x: 20.5, y: 4.5 }, to: { x: 20.5, y: 15.5 } },
] as const;

function drawDashedWorldLine(
  g: PixiGraphics,
  from: { x: number; y: number },
  to: { x: number; y: number }
): void {
  const a = isoToScreen(from.x, from.y);
  const b = isoToScreen(to.x, to.y);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  let d = 0;
  while (d < len - 12) {
    const e = Math.min(d + 10, len - 12);
    g.moveTo(a.x + ux * d, a.y + uy * d);
    g.lineTo(a.x + ux * e, a.y + uy * e);
    d = e + 7;
  }
  g.lineStyle(0);
  g.beginFill(0xeaf2ff, 0.9);
  g.drawPolygon([b.x, b.y, b.x - ux * 12 + -uy * 5, b.y - uy * 12 + ux * 5, b.x - ux * 12 - -uy * 5, b.y - uy * 12 - ux * 5]);
  g.endFill();
  g.lineStyle(3, 0xeaf2ff, 0.9);
}

/** Corridor flow arrows + numbered step badges (reference image's ①〜⑤ workflow overlay). */
function FlowOverlay() {
  const drawLines = (g: PixiGraphics) => {
    g.clear();
    g.lineStyle(3, 0xeaf2ff, 0.9);
    for (const line of FLOW_LINES) drawDashedWorldLine(g, line.from, line.to);
  };
  return (
    <>
      <Graphics draw={drawLines} />
      {FLOW_STEPS.map((step) => {
        const p = isoToScreen(step.wx, step.wy);
        const drawBadge = (g: PixiGraphics) => {
          g.clear();
          g.lineStyle(2, 0xffffff, 1);
          g.beginFill(0x2f6fed);
          g.drawCircle(p.x, p.y, 10);
          g.endFill();
        };
        return (
          <Container key={step.n}>
            <Graphics draw={drawBadge} />
            <Text text={step.n} x={p.x} y={p.y} anchor={0.5} style={STEP_NUMBER_STYLE} />
            <Text text={step.label} x={p.x + 15} y={p.y} anchor={{ x: 0, y: 0.5 }} style={STEP_LABEL_STYLE} />
          </Container>
        );
      })}
    </>
  );
}

function CharacterLayer() {
  const employees = useOfficeStore((s) => s.employees);
  return (
    <>
      {Object.values(employees).map((employee) => (
        <CharacterSprite key={employee.agentId} employee={employee} />
      ))}
    </>
  );
}

/**
 * docs/10_OFFICE_SYSTEM.md + docs/07 "カイロソフト風": the full 12-area floor rendered as a true
 * isometric diorama - diamond floor grid, height-cut walls with painter's-algorithm occlusion,
 * corridor arrows and floating name plates, with all movement happening in world (tile) space.
 */
export function OfficeCanvas() {
  return (
    <Stage width={OFFICE_WIDTH} height={OFFICE_HEIGHT} options={{ backgroundColor: 0xedeef2, antialias: false }}>
      <Container sortableChildren>
        <BaseFloor />
        {PHASE2_AREA_LAYOUT.map((area) => (
          <RoomFloor key={`floor-${area.areaId}`} area={area} />
        ))}
        {PHASE2_AREA_LAYOUT.map((area) => (
          <RoomWalls key={`walls-${area.areaId}`} area={area} />
        ))}
        {PHASE2_AREA_LAYOUT.map((area) => (
          <ExteriorWindows key={`win-${area.areaId}`} area={area} />
        ))}
        {PHASE2_AREA_LAYOUT.map((area) => (
          <AreaFurniture key={`furniture-${area.areaId}`} area={area} />
        ))}
        {PHASE2_AREA_LAYOUT.map((area) => (
          <AreaAccessory key={`acc-${area.areaId}`} area={area} />
        ))}
        {PHASE2_AREA_LAYOUT.map((area) => (
          <RoomPlant key={`plant-${area.areaId}`} area={area} />
        ))}
        <ExteriorTrees />
        <CharacterLayer />
      </Container>
      <Container>
        <FlowOverlay />
        <EntranceSign />
        {PHASE2_AREA_LAYOUT.map((area) => (
          <RoomLabel key={`label-${area.areaId}`} area={area} />
        ))}
      </Container>
    </Stage>
  );
}
