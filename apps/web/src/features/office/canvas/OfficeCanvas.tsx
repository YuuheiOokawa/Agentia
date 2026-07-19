"use client";

import { Fragment } from "react";
import { Stage, Container, Graphics, Sprite, Text } from "@pixi/react";
import { TextMetrics, TextStyle, type Graphics as PixiGraphics } from "pixi.js";
import { useOfficeStore } from "@/stores/office-store";
import { lightenColor, shadeColor } from "@/lib/color";
import { AREA_ACCESSORY, AREA_FURNITURE, areaSlots, PHASE2_AREA_LAYOUT, type AreaLayout } from "../map/map";
import {
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

const FURNITURE_SCALE = 0.34;
const WINDOW_SCALE = 0.26;

/** Traces one floor tile's diamond at world tile (tx, ty). */
function tileDiamond(g: PixiGraphics, tx: number, ty: number): void {
  const top = isoToScreen(tx, ty);
  const right = isoToScreen(tx + 1, ty);
  const bottom = isoToScreen(tx + 1, ty + 1);
  const left = isoToScreen(tx, ty + 1);
  g.drawPolygon([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y]);
}

/** Neutral checkerboard under the whole grid - corridors and the ground rooms sit on. */
function BaseFloor() {
  const draw = (g: PixiGraphics) => {
    g.clear();
    for (let ty = 0; ty < GRID_ROWS; ty += 1) {
      for (let tx = 0; tx < GRID_COLS; tx += 1) {
        g.beginFill((tx + ty) % 2 === 0 ? 0xd9d6cf : 0xcfccc4);
        tileDiamond(g, tx, ty);
        g.endFill();
      }
    }
  };
  return <Graphics zIndex={-1000} draw={draw} />;
}

/** A room's colored checker floor (two lightened shades of its accent color). */
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
  const trim = lightenColor(base, 0.55);

  const segments: Array<{ key: string; z: number; draw: (g: PixiGraphics) => void }> = [];

  for (let tx = area.gx; tx < area.gx + area.gw; tx += 1) {
    const p1 = isoToScreen(tx, area.gy);
    const p2 = isoToScreen(tx + 1, area.gy);
    segments.push({
      key: `n${tx}`,
      z: isoDepth(tx + 0.5, area.gy) - 0.1,
      draw: (g) => {
        g.clear();
        g.beginFill(north);
        g.drawPolygon([p1.x, p1.y, p2.x, p2.y, p2.x, p2.y - WALL_H, p1.x, p1.y - WALL_H]);
        g.endFill();
        g.beginFill(trim);
        g.drawPolygon([p1.x, p1.y - WALL_H, p2.x, p2.y - WALL_H, p2.x, p2.y - WALL_H + 3, p1.x, p1.y - WALL_H + 3]);
        g.endFill();
      },
    });

    const q1 = isoToScreen(tx, area.gy + area.gh);
    const q2 = isoToScreen(tx + 1, area.gy + area.gh);
    segments.push({
      key: `s${tx}`,
      z: isoDepth(tx + 0.5, area.gy + area.gh) - 0.1,
      draw: (g) => {
        g.clear();
        g.beginFill(parapet);
        g.drawPolygon([q1.x, q1.y, q2.x, q2.y, q2.x, q2.y - PARAPET_H, q1.x, q1.y - PARAPET_H]);
        g.endFill();
        g.beginFill(trim);
        g.drawPolygon([q1.x, q1.y - PARAPET_H, q2.x, q2.y - PARAPET_H, q2.x, q2.y - PARAPET_H + 2, q1.x, q1.y - PARAPET_H + 2]);
        g.endFill();
      },
    });
  }

  for (let ty = area.gy; ty < area.gy + area.gh; ty += 1) {
    const p1 = isoToScreen(area.gx, ty);
    const p2 = isoToScreen(area.gx, ty + 1);
    segments.push({
      key: `w${ty}`,
      z: isoDepth(area.gx, ty + 0.5) - 0.1,
      draw: (g) => {
        g.clear();
        g.beginFill(west);
        g.drawPolygon([p1.x, p1.y, p2.x, p2.y, p2.x, p2.y - WALL_H, p1.x, p1.y - WALL_H]);
        g.endFill();
        g.beginFill(trim);
        g.drawPolygon([p1.x, p1.y - WALL_H, p2.x, p2.y - WALL_H, p2.x, p2.y - WALL_H + 3, p1.x, p1.y - WALL_H + 3]);
        g.endFill();
      },
    });

    const q1 = isoToScreen(area.gx + area.gw, ty);
    const q2 = isoToScreen(area.gx + area.gw, ty + 1);
    segments.push({
      key: `e${ty}`,
      z: isoDepth(area.gx + area.gw, ty + 0.5) - 0.1,
      draw: (g) => {
        g.clear();
        g.beginFill(parapetSide);
        g.drawPolygon([q1.x, q1.y, q2.x, q2.y, q2.x, q2.y - PARAPET_H, q1.x, q1.y - PARAPET_H]);
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
        <CharacterLayer />
      </Container>
      <Container>
        <FlowOverlay />
        {PHASE2_AREA_LAYOUT.map((area) => (
          <RoomLabel key={`label-${area.areaId}`} area={area} />
        ))}
      </Container>
    </Stage>
  );
}
