"use client";

import { Fragment, useEffect, useState } from "react";
import { Application, extend } from "@pixi/react";
import {
  Container,
  Graphics,
  Sprite,
  Text,
  CanvasTextMetrics,
  TextStyle,
  type Graphics as PixiGraphics,
} from "pixi.js";
import { useOfficeStore } from "@/stores/office-store";
import { lightenColor, shadeColor } from "@/lib/color";
import {
  AREA_DOORS,
  areaDecorPlacements,
  areaFurniturePlacements,
  PHASE2_AREA_LAYOUT,
  type AreaLayout,
} from "../map/map";
import {
  APRON_TILES,
  GRID_COLS,
  GRID_ROWS,
  isoDepth,
  isoToScreen,
  realisticToScreen,
  NORTH_WALL_SKEW_Y,
  OFFICE_HEIGHT,
  OFFICE_WIDTH,
  PARAPET_H,
  WALL_H,
} from "../map/iso";
import { CharacterSprite } from "../characters/CharacterSprite";
import { furnitureTexture, loadOfficeAssets, realisticOfficeTexture, windowTexture } from "../pixel-assets";

// PixiJS v8: React components are created from pixi classes via extend() - this registers the
// <pixiContainer>/<pixiGraphics>/<pixiSprite>/<pixiText> intrinsic elements used below.
extend({ Container, Graphics, Sprite, Text });

const AREA_LABEL_STYLE = new TextStyle({ fontSize: 12, fontWeight: "700", fill: 0xffffff });
const STEP_LABEL_STYLE = new TextStyle({
  fontSize: 11,
  fontWeight: "700",
  fill: 0xffffff,
  stroke: { color: 0x1a2b45, width: 3 },
});
const STEP_NUMBER_STYLE = new TextStyle({ fontSize: 11, fontWeight: "700", fill: 0xffffff });

/** The new isometric voxel props are drawn on smaller grids than the old flat billboards. */
const FURNITURE_SCALE = 0.5;
const WINDOW_SCALE = 0.26;
const USE_REALISTIC_SCENE = true;

/** Dark surroundings so the warm-lit interior pops like a night-time diorama: page/canvas
 * background, then two subtle checker shades for the sidewalk apron ringing the building. */
export const CANVAS_BACKGROUND = 0x1e222c;
const APRON_SHADE_A = 0x2a2f3a;
const APRON_SHADE_B = 0x262b35;
const DOORMAT_COLOR = 0x4a505c;
const CURB_COLOR = 0x59616f;
const CURB_HIGHLIGHT = 0x747d8c;
const FLOOR_GROUT = 0x4b5360;

/** Each room uses a material that matches its job instead of sharing one generic checker floor. */
type FloorMaterial = "carpet" | "wood" | "raised" | "vinyl" | "rubber";

function floorMaterial(area: AreaLayout): FloorMaterial {
  if (["library", "meeting_room", "pm_space"].includes(area.areaId)) return "wood";
  if (["server_room", "github_hub"].includes(area.areaId)) return "raised";
  if (["terminal_room", "qa_room", "deploy_area"].includes(area.areaId)) return "rubber";
  if (area.areaId === "break_room") return "vinyl";
  return "carpet";
}

function traceWorldQuad(
  g: PixiGraphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  const a = isoToScreen(x1, y1);
  const b = isoToScreen(x2, y1);
  const c = isoToScreen(x2, y2);
  const d = isoToScreen(x1, y2);
  g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
}

/** Traces one floor tile's diamond at world tile (tx, ty). */
function tileDiamond(g: PixiGraphics, tx: number, ty: number): void {
  const top = isoToScreen(tx, ty);
  const right = isoToScreen(tx + 1, ty);
  const bottom = isoToScreen(tx + 1, ty + 1);
  const left = isoToScreen(tx, ty + 1);
  g.poly([top.x, top.y, right.x, right.y, bottom.x, bottom.y, left.x, left.y]);
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
        const color = inside
          ? (tx + ty) % 2 === 0
            ? 0xd9d6cf
            : 0xcfccc4
          : (tx + ty) % 2 === 0
            ? APRON_SHADE_A
            : APRON_SHADE_B;
        tileDiamond(g, tx, ty);
        g.fill(color);
        g.stroke({ width: 0.65, color: FLOOR_GROUT, alpha: inside ? 0.11 : 0.24 });

        // A tiny inset paver on the apron keeps the outside from reading as one flat slab.
        if (!inside && (tx + ty) % 3 === 0) {
          traceWorldQuad(g, tx + 0.18, ty + 0.18, tx + 0.82, ty + 0.82);
          g.stroke({ width: 0.6, color: 0x88909c, alpha: 0.11 });
        }
      }
    }

    // Raised curb around the building footprint.
    const nw = isoToScreen(0, 0);
    const ne = isoToScreen(GRID_COLS, 0);
    const se = isoToScreen(GRID_COLS, GRID_ROWS);
    const sw = isoToScreen(0, GRID_ROWS);
    g.poly([nw.x, nw.y, ne.x, ne.y, se.x, se.y, sw.x, sw.y]);
    g.stroke({ width: 3, color: CURB_COLOR, alpha: 0.95 });
    g.poly([nw.x, nw.y - 2, ne.x, ne.y - 2, se.x, se.y - 2, sw.x, sw.y - 2]);
    g.stroke({ width: 1, color: CURB_HIGHLIGHT, alpha: 0.8 });

    // Building shadow onto the apron (south face, then east face) - a touch stronger so it still
    // reads against the dark ground.
    const s1 = isoToScreen(0, GRID_ROWS);
    const s2 = isoToScreen(GRID_COLS, GRID_ROWS);
    const s3 = isoToScreen(GRID_COLS, GRID_ROWS + 0.8);
    const s4 = isoToScreen(0, GRID_ROWS + 0.8);
    g.poly([s1.x, s1.y, s2.x, s2.y, s3.x, s3.y, s4.x, s4.y]);
    g.fill({ color: 0x000000, alpha: 0.22 });
    const e1 = isoToScreen(GRID_COLS, 0);
    const e2 = isoToScreen(GRID_COLS, GRID_ROWS);
    const e3 = isoToScreen(GRID_COLS + 0.8, GRID_ROWS);
    const e4 = isoToScreen(GRID_COLS + 0.8, 0);
    g.poly([e1.x, e1.y, e2.x, e2.y, e3.x, e3.y, e4.x, e4.y]);
    g.fill({ color: 0x000000, alpha: 0.22 });

    // Entrance doormat centered on the building's front edge.
    const mat = isoToScreen(13.5, GRID_ROWS + 0.55);
    g.poly([mat.x - 20, mat.y, mat.x, mat.y - 10, mat.x + 20, mat.y, mat.x, mat.y + 10]);
    g.fill(DOORMAT_COLOR);

    // Entrance crossing / guide stripes on the apron.
    for (let i = 0; i < 5; i += 1) {
      traceWorldQuad(g, 12.1 + i * 0.72, GRID_ROWS + 0.88, 12.55 + i * 0.72, GRID_ROWS + 1.55);
      g.fill({ color: 0xd7dbe1, alpha: 0.68 });
    }

    // Parking bay marks along the south apron, plus a small storm drain by the entrance.
    for (const tx of [2, 5, 8, 19, 22, 25]) {
      const a = isoToScreen(tx, GRID_ROWS + 0.25);
      const b = isoToScreen(tx, GRID_ROWS + 1.72);
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
    }
    g.stroke({ width: 1.25, color: 0xc6cbd2, alpha: 0.42 });
    traceWorldQuad(g, 15.8, GRID_ROWS + 0.25, 16.65, GRID_ROWS + 0.68);
    g.fill({ color: 0x151a22, alpha: 0.9 });
    for (let i = 0; i < 4; i += 1) {
      const a = isoToScreen(15.95 + i * 0.18, GRID_ROWS + 0.27);
      const b = isoToScreen(16.2 + i * 0.18, GRID_ROWS + 0.64);
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
    }
    g.stroke({ width: 0.8, color: 0x697180, alpha: 0.9 });
  };
  return <pixiGraphics zIndex={-1000} draw={draw} />;
}

/** A room's colored checker floor (two lightened shades of its accent color), with a soft ambient-
 * occlusion strip along the two back walls so the floor visibly "meets" them - the classic
 * Kairosoft interior shading cue. */
function RoomFloor({ area }: { area: AreaLayout }) {
  const material = floorMaterial(area);
  const shadeA = material === "raised" ? lightenColor(area.color, 0.36) : lightenColor(area.color, 0.76);
  const shadeB = material === "raised" ? lightenColor(area.color, 0.28) : lightenColor(area.color, 0.68);
  const draw = (g: PixiGraphics) => {
    g.clear();
    for (let ty = area.gy; ty < area.gy + area.gh; ty += 1) {
      for (let tx = area.gx; tx < area.gx + area.gw; tx += 1) {
        tileDiamond(g, tx, ty);
        g.fill((tx + ty) % 2 === 0 ? shadeA : shadeB);
        g.stroke({ width: material === "raised" ? 1 : 0.55, color: shadeColor(area.color, 0.54), alpha: 0.2 });

        // Material-specific texture: seams, carpet flecks, anti-static panel fasteners.
        if (material === "wood") {
          const a = isoToScreen(tx + 0.15, ty + 0.5);
          const b = isoToScreen(tx + 0.85, ty + 0.5);
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke({ width: 0.7, color: shadeColor(area.color, 0.5), alpha: 0.22 });
        } else if (material === "carpet" && (tx * 3 + ty) % 4 === 0) {
          const p = isoToScreen(tx + 0.35, ty + 0.62);
          g.circle(p.x, p.y, 0.9);
          g.fill({ color: shadeColor(area.color, 0.42), alpha: 0.22 });
        } else if (material === "raised") {
          const p = isoToScreen(tx + 0.18, ty + 0.18);
          g.circle(p.x, p.y, 0.8);
          g.fill({ color: 0x98dce8, alpha: 0.34 });
        } else if (material === "rubber") {
          const a = isoToScreen(tx + 0.2, ty + 0.78);
          const b = isoToScreen(tx + 0.78, ty + 0.2);
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke({ width: 0.55, color: 0xffffff, alpha: 0.1 });
        }
      }
    }

    // Soft pool from an overhead fixture. Kept subtle so sprites remain crisp.
    const center = isoToScreen(area.gx + area.gw / 2, area.gy + area.gh / 2);
    g.ellipse(center.x, center.y, Math.max(30, area.gw * 9), Math.max(11, area.gh * 5));
    g.fill({ color: area.areaId === "server_room" ? 0x79d8ff : 0xfff1c2, alpha: 0.075 });

    // Purpose-built room details make each zone recognizable even without its floating label.
    if (area.areaId === "meeting_room") {
      traceWorldQuad(g, area.gx + 1.1, area.gy + 0.85, area.gx + area.gw - 1.1, area.gy + area.gh - 0.65);
      g.fill({ color: 0x5f356f, alpha: 0.28 });
      g.stroke({ width: 1.2, color: 0xd8b7df, alpha: 0.38 });
    }
    if (area.areaId === "server_room") {
      for (let tx = area.gx + 0.7; tx < area.gx + area.gw - 0.5; tx += 1.35) {
        const a = isoToScreen(tx, area.gy + area.gh - 0.7);
        const b = isoToScreen(tx + 0.55, area.gy + area.gh - 0.7);
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
      }
      g.stroke({ width: 2, color: 0x65d7ef, alpha: 0.42 });
    }
    if (area.areaId === "qa_room" || area.areaId === "deploy_area") {
      for (let tx = area.gx + 0.5; tx < area.gx + area.gw - 0.5; tx += 0.7) {
        traceWorldQuad(g, tx, area.gy + area.gh - 0.38, tx + 0.34, area.gy + area.gh - 0.1);
        g.fill({ color: area.areaId === "qa_room" ? 0xf4d35e : 0xff9f43, alpha: 0.38 });
      }
    }
    if (area.areaId === "break_room") {
      traceWorldQuad(g, area.gx + 8, area.gy + 0.55, area.gx + 19, area.gy + area.gh - 0.45);
      g.fill({ color: 0xd9b36c, alpha: 0.24 });
      g.stroke({ width: 1, color: 0xffe3a5, alpha: 0.42 });
    }

    const n1 = isoToScreen(area.gx, area.gy);
    const n2 = isoToScreen(area.gx + area.gw, area.gy);
    const n3 = isoToScreen(area.gx + area.gw, area.gy + 0.45);
    const n4 = isoToScreen(area.gx, area.gy + 0.45);
    g.poly([n1.x, n1.y, n2.x, n2.y, n3.x, n3.y, n4.x, n4.y]);
    g.fill({ color: 0x000000, alpha: 0.09 });
    const w1 = isoToScreen(area.gx, area.gy);
    const w2 = isoToScreen(area.gx, area.gy + area.gh);
    const w3 = isoToScreen(area.gx + 0.45, area.gy + area.gh);
    const w4 = isoToScreen(area.gx + 0.45, area.gy);
    g.poly([w1.x, w1.y, w2.x, w2.y, w3.x, w3.y, w4.x, w4.y]);
    g.fill({ color: 0x000000, alpha: 0.09 });

    // Daylight pools slanting in from the exterior windows (topmost band only).
    if (area.row === 0) {
      for (const wx of [area.gx + 1, area.gx + area.gw - 2.4]) {
        const l1 = isoToScreen(wx - 0.1, area.gy);
        const l2 = isoToScreen(wx + 1.3, area.gy);
        const l3 = isoToScreen(wx + 1.9, area.gy + 1.7);
        const l4 = isoToScreen(wx + 0.5, area.gy + 1.7);
        g.poly([l1.x, l1.y, l2.x, l2.y, l3.x, l3.y, l4.x, l4.y]);
        g.fill({ color: 0xffffff, alpha: 0.12 });
      }
    }
  };
  return <pixiGraphics zIndex={-500} draw={draw} />;
}

/** Full-resolution architectural diorama used as the realistic scene layer. */
function RealisticOfficeBackground() {
  return (
    <pixiSprite
      texture={realisticOfficeTexture()}
      x={0}
      y={0}
      width={OFFICE_WIDTH}
      height={OFFICE_HEIGHT}
      zIndex={-1000}
      eventMode="none"
    />
  );
}

/** Floor-level wayfinding and cable/service channels shared by all rooms. */
function CorridorDetails() {
  const draw = (g: PixiGraphics) => {
    g.clear();
    for (const y of [4.5, 10.5, 15.5]) {
      const a = isoToScreen(0.4, y);
      const b = isoToScreen(GRID_COLS - 0.4, y);
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke({ width: 5, color: 0x2f3744, alpha: 0.38 });
      g.moveTo(a.x, a.y - 1);
      g.lineTo(b.x, b.y - 1);
      g.stroke({ width: 1, color: 0xaeb7c3, alpha: 0.38 });
    }
    const va = isoToScreen(20.5, 0.35);
    const vb = isoToScreen(20.5, GRID_ROWS - 0.35);
    g.moveTo(va.x, va.y);
    g.lineTo(vb.x, vb.y);
    g.stroke({ width: 4, color: 0x2f3744, alpha: 0.36 });
    g.moveTo(va.x + 1, va.y);
    g.lineTo(vb.x + 1, vb.y);
    g.stroke({ width: 1, color: 0x8fd3e8, alpha: 0.46 });
  };
  return <pixiGraphics zIndex={-420} draw={draw} />;
}

/**
 * Room walls as per-tile segments so painter's sorting works: a character standing in front of a
 * wall segment (greater world depth) draws over it, one standing behind it (in a corridor/other
 * room) is hidden by it. Exterior back/west walls are full height, interior partitions mid-height,
 * front/east walls low parapets - every room reads as an open box you look into.
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
  const doorFrame = 0x8a6f52;
  const threshold = 0xe8e2d4;

  /** Wall/parapet thickness in tiles, extruded outward from the room. */
  const T = 0.14;
  const TP = 0.1;

  /** STEP2: this room's doorways - those wall tiles render as openings instead of solid segments. */
  const doors = AREA_DOORS.filter((d) => d.areaId === area.areaId);
  const northDoorCols = new Set(doors.filter((d) => d.side === "north").map((d) => d.cx));
  const southDoorCols = new Set(doors.filter((d) => d.side === "south").map((d) => d.cx));
  /** Height of the header bar left above a doorway cut into a full-height wall. */
  const LINTEL_H = 12;
  /** Interior partition walls are mid-height so characters walking the corridor BEHIND a room
   * still peek over them (full-height walls would swallow corridor walkers whole); only the
   * building's exterior back/west walls keep the full height. */
  const PARTITION_WALL_H = 20;
  const northH = area.row === 0 ? WALL_H : PARTITION_WALL_H;
  const westH = area.gx === 0 ? WALL_H : PARTITION_WALL_H;

  const segments: Array<{ key: string; z: number; draw: (g: PixiGraphics) => void }> = [];

  for (let tx = area.gx; tx < area.gx + area.gw; tx += 1) {
    const p1 = isoToScreen(tx, area.gy);
    const p2 = isoToScreen(tx + 1, area.gy);
    const c1 = isoToScreen(tx, area.gy - T);
    const c2 = isoToScreen(tx + 1, area.gy - T);
    if (northDoorCols.has(tx)) {
      // Doorway through the back wall: side jambs + lintel, with the gap showing the corridor
      // behind - characters walk through this opening.
      const j1 = isoToScreen(tx + 0.14, area.gy);
      const j2 = isoToScreen(tx + 0.86, area.gy);
      const t1 = isoToScreen(tx + 0.08, area.gy - 0.3);
      const t2 = isoToScreen(tx + 0.92, area.gy - 0.3);
      const t3 = isoToScreen(tx + 0.92, area.gy + 0.3);
      const t4 = isoToScreen(tx + 0.08, area.gy + 0.3);
      segments.push({
        key: `n${tx}`,
        z: isoDepth(tx + 0.5, area.gy) - 0.1,
        draw: (g) => {
          g.clear();
          // Threshold strip on the floor through the opening.
          g.poly([t1.x, t1.y, t2.x, t2.y, t3.x, t3.y, t4.x, t4.y]);
          g.fill({ color: threshold, alpha: 0.9 });
          // Jambs (door frame posts), slightly taller than the wall they interrupt.
          g.poly([p1.x, p1.y, j1.x, j1.y, j1.x, j1.y - northH - 2, p1.x, p1.y - northH - 2]);
          g.fill(doorFrame);
          g.poly([j2.x, j2.y, p2.x, p2.y, p2.x, p2.y - northH - 2, j2.x, j2.y - northH - 2]);
          g.fill(doorFrame);
          // Lintel across the top (only on full-height walls; partitions stay open above).
          if (northH === WALL_H) {
            g.poly([j1.x, j1.y - northH + LINTEL_H, j2.x, j2.y - northH + LINTEL_H, j2.x, j2.y - northH, j1.x, j1.y - northH]);
            g.fill(doorFrame);
          }
        },
      });
    } else {
      segments.push({
        key: `n${tx}`,
        z: isoDepth(tx + 0.5, area.gy) - 0.1,
        draw: (g) => {
          g.clear();
          g.poly([p1.x, p1.y, p2.x, p2.y, p2.x, p2.y - northH, p1.x, p1.y - northH]);
          g.fill(north);
          g.poly([c1.x, c1.y - northH, c2.x, c2.y - northH, p2.x, p2.y - northH, p1.x, p1.y - northH]);
          g.fill(cap);
          // Baseboard, panel seam and cap highlight make the wall feel constructed rather than flat.
          g.moveTo(p1.x, p1.y - 4);
          g.lineTo(p2.x, p2.y - 4);
          g.stroke({ width: 2, color: shadeColor(base, 0.48), alpha: 0.46 });
          g.moveTo(p1.x, p1.y - northH + 3);
          g.lineTo(p2.x, p2.y - northH + 3);
          g.stroke({ width: 1, color: 0xffffff, alpha: 0.22 });
          g.moveTo(p1.x, p1.y - 4);
          g.lineTo(p1.x, p1.y - northH + 3);
          g.stroke({ width: 0.65, color: shadeColor(base, 0.42), alpha: 0.2 });
        },
      });
    }

    const q1 = isoToScreen(tx, area.gy + area.gh);
    const q2 = isoToScreen(tx + 1, area.gy + area.gh);
    const d1 = isoToScreen(tx, area.gy + area.gh + TP);
    const d2 = isoToScreen(tx + 1, area.gy + area.gh + TP);
    if (southDoorCols.has(tx)) {
      // Gap in the front parapet: two small post stubs + a threshold strip mark the entrance.
      const s1 = isoToScreen(tx + 0.16, area.gy + area.gh);
      const s2 = isoToScreen(tx + 0.84, area.gy + area.gh);
      const t1 = isoToScreen(tx + 0.08, area.gy + area.gh - 0.3);
      const t2 = isoToScreen(tx + 0.92, area.gy + area.gh - 0.3);
      const t3 = isoToScreen(tx + 0.92, area.gy + area.gh + 0.3);
      const t4 = isoToScreen(tx + 0.08, area.gy + area.gh + 0.3);
      segments.push({
        key: `s${tx}`,
        z: isoDepth(tx + 0.5, area.gy + area.gh) - 0.1,
        draw: (g) => {
          g.clear();
          g.poly([t1.x, t1.y, t2.x, t2.y, t3.x, t3.y, t4.x, t4.y]);
          g.fill({ color: threshold, alpha: 0.9 });
          g.poly([q1.x, q1.y, s1.x, s1.y, s1.x, s1.y - PARAPET_H - 4, q1.x, q1.y - PARAPET_H - 4]);
          g.fill(doorFrame);
          g.poly([s2.x, s2.y, q2.x, q2.y, q2.x, q2.y - PARAPET_H - 4, s2.x, s2.y - PARAPET_H - 4]);
          g.fill(doorFrame);
        },
      });
    } else {
      segments.push({
        key: `s${tx}`,
        z: isoDepth(tx + 0.5, area.gy + area.gh) - 0.1,
        draw: (g) => {
          g.clear();
          g.poly([d1.x, d1.y, d2.x, d2.y, d2.x, d2.y - PARAPET_H, d1.x, d1.y - PARAPET_H]);
          g.fill(parapet);
          g.poly([q1.x, q1.y - PARAPET_H, q2.x, q2.y - PARAPET_H, d2.x, d2.y - PARAPET_H, d1.x, d1.y - PARAPET_H]);
          g.fill(cap);
          g.moveTo(d1.x, d1.y - 3);
          g.lineTo(d2.x, d2.y - 3);
          g.stroke({ width: 1.5, color: parapetSide, alpha: 0.48 });
          g.moveTo(q1.x, q1.y - PARAPET_H + 1);
          g.lineTo(q2.x, q2.y - PARAPET_H + 1);
          g.stroke({ width: 0.8, color: 0xffffff, alpha: 0.28 });
        },
      });
    }
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
        g.poly([p1.x, p1.y, p2.x, p2.y, p2.x, p2.y - westH, p1.x, p1.y - westH]);
        g.fill(west);
        g.poly([c1.x, c1.y - westH, c2.x, c2.y - westH, p2.x, p2.y - westH, p1.x, p1.y - westH]);
        g.fill(cap);
        g.moveTo(p1.x, p1.y - 4);
        g.lineTo(p2.x, p2.y - 4);
        g.stroke({ width: 2, color: shadeColor(west, 0.46), alpha: 0.46 });
        g.moveTo(p1.x, p1.y - westH + 3);
        g.lineTo(p2.x, p2.y - westH + 3);
        g.stroke({ width: 1, color: 0xffffff, alpha: 0.18 });
        g.moveTo(p1.x, p1.y - 4);
        g.lineTo(p1.x, p1.y - westH + 3);
        g.stroke({ width: 0.65, color: 0x000000, alpha: 0.16 });
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
        g.poly([d1.x, d1.y, d2.x, d2.y, d2.x, d2.y - PARAPET_H, d1.x, d1.y - PARAPET_H]);
        g.fill(parapetSide);
        g.poly([q1.x, q1.y - PARAPET_H, q2.x, q2.y - PARAPET_H, d2.x, d2.y - PARAPET_H, d1.x, d1.y - PARAPET_H]);
        g.fill(cap);
        g.moveTo(d1.x, d1.y - 3);
        g.lineTo(d2.x, d2.y - 3);
        g.stroke({ width: 1.5, color: shadeColor(parapetSide, 0.62), alpha: 0.5 });
        g.moveTo(q1.x, q1.y - PARAPET_H + 1);
        g.lineTo(q2.x, q2.y - PARAPET_H + 1);
        g.stroke({ width: 0.8, color: 0xffffff, alpha: 0.24 });
      },
    });
  }

  // Corner cap where the two back walls meet, closing the top face neatly (at the lower of the
  // two wall heights when they differ).
  {
    const cornerH = Math.min(northH, westH);
    const k1 = isoToScreen(area.gx - T, area.gy - T);
    const k2 = isoToScreen(area.gx, area.gy - T);
    const k3 = isoToScreen(area.gx, area.gy);
    const k4 = isoToScreen(area.gx - T, area.gy);
    segments.push({
      key: "nw-cap",
      z: isoDepth(area.gx, area.gy) - 0.1,
      draw: (g) => {
        g.clear();
        g.poly([k1.x, k1.y - cornerH, k2.x, k2.y - cornerH, k3.x, k3.y - cornerH, k4.x, k4.y - cornerH]);
        g.fill(cap);
      },
    });
  }

  return (
    <>
      {segments.map((s) => (
        <pixiGraphics key={s.key} zIndex={s.z} draw={s.draw} />
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
          <pixiSprite
            key={i}
            texture={windowTexture()}
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

/** Furniture at its nav-grid cell (the same placements the collision grid marks solid, so what you
 * see is exactly what blocks walking); depth-sorted with everything else, grounding shadow per prop. */
function AreaFurniture({ area }: { area: AreaLayout }) {
  return (
    <>
      {areaFurniturePlacements(area.areaId).map((placement, i) => {
        const wx = placement.cell.cx + 0.5;
        const wy = placement.cell.cy + 0.5;
        const screen = isoToScreen(wx, wy);
        const z = isoDepth(wx, wy);
        const drawShadow = (g: PixiGraphics) => {
          g.clear();
          g.ellipse(screen.x, screen.y + 2, 16, 5);
          g.fill({ color: 0x000000, alpha: 0.16 });
        };
        // Direct siblings of the sortable world container (a wrapper Container would collapse
        // their depth to zIndex 0 and break occlusion against characters).
        return (
          <Fragment key={i}>
            <pixiGraphics zIndex={z - 0.01} draw={drawShadow} />
            <pixiSprite
              texture={furnitureTexture(placement.prop)}
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

/** Corner plants and back-wall accessories - drawn from the same collision-tied placements as the
 * nav grid (STEP8: decorations never silently block a path). */
function AreaDecor({ area }: { area: AreaLayout }) {
  return (
    <>
      {areaDecorPlacements(area.areaId).map((decor, i) => {
        const wx = decor.cell.cx + 0.5;
        const wy = decor.cell.cy + 0.5;
        const screen = isoToScreen(wx, wy);
        return (
          <pixiSprite
            key={i}
            texture={furnitureTexture(decor.prop)}
            x={screen.x}
            y={screen.y + 3}
            anchor={{ x: 0.5, y: 1 }}
            scale={{ x: decor.scale, y: decor.scale }}
            zIndex={isoDepth(wx, wy)}
          />
        );
      })}
    </>
  );
}

/** Wall-mounted practical lights, status panels and subtle pools of warm light. */
function RoomFixtures({ area }: { area: AreaLayout }) {
  const wallH = area.row === 0 ? WALL_H : 20;
  const anchor = isoToScreen(area.gx + area.gw / 2, area.gy);
  const fixtureY = anchor.y - wallH + 8;
  const statusColor =
    area.areaId === "server_room"
      ? 0x63d9ff
      : area.areaId === "qa_room"
        ? 0x7be495
        : area.areaId === "deploy_area"
          ? 0xffb45f
          : 0xffe1a3;
  const draw = (g: PixiGraphics) => {
    g.clear();
    // Diffuse light cone down the wall.
    g.poly([
      anchor.x - 5,
      fixtureY + 3,
      anchor.x + 5,
      fixtureY + 3,
      anchor.x + 17,
      anchor.y - 2,
      anchor.x - 17,
      anchor.y - 2,
    ]);
    g.fill({ color: statusColor, alpha: 0.08 });
    g.roundRect(anchor.x - 9, fixtureY, 18, 4, 1.5);
    g.fill({ color: 0x303845, alpha: 0.96 });
    g.roundRect(anchor.x - 6, fixtureY + 1, 12, 2, 1);
    g.fill({ color: statusColor, alpha: 0.92 });
    g.circle(anchor.x + 11, fixtureY + 2, 1.2);
    g.fill({ color: 0x75e596, alpha: 0.95 });
  };
  return <pixiGraphics zIndex={isoDepth(area.gx + area.gw / 2, area.gy) - 0.03} draw={draw} />;
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
          <pixiSprite
            key={i}
            texture={furnitureTexture("plant")}
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

const STREET_LIGHTS = [
  { wx: -1.45, wy: 0.5 },
  { wx: GRID_COLS + 1.45, wy: 2.5 },
  { wx: 2.5, wy: GRID_ROWS + 1.35 },
  { wx: 24.5, wy: GRID_ROWS + 1.35 },
] as const;

/** Street furniture makes the office read as a place embedded in a site, not a floating game board. */
function ExteriorFixtures() {
  return (
    <>
      {STREET_LIGHTS.map((light, index) => {
        const p = isoToScreen(light.wx, light.wy);
        const draw = (g: PixiGraphics) => {
          g.clear();
          g.ellipse(p.x + 7, p.y + 3, 16, 4);
          g.fill({ color: 0x000000, alpha: 0.2 });
          g.rect(p.x - 1.5, p.y - 38, 3, 39);
          g.fill(0x48515e);
          g.rect(p.x - 6, p.y - 40, 12, 4);
          g.fill(0x2f3742);
          g.circle(p.x, p.y - 38, 11);
          g.fill({ color: 0xffd886, alpha: 0.08 });
          g.roundRect(p.x - 4, p.y - 39, 8, 3, 1);
          g.fill(0xffd27c);
          g.rect(p.x - 4, p.y, 8, 2);
          g.fill(0x343c48);
        };
        return <pixiGraphics key={index} zIndex={isoDepth(light.wx, light.wy)} draw={draw} />;
      })}
      {[
        { wx: 8.5, wy: GRID_ROWS + 1.25 },
        { wx: 18.5, wy: GRID_ROWS + 1.25 },
      ].map((bench, index) => {
        const p = isoToScreen(bench.wx, bench.wy);
        const draw = (g: PixiGraphics) => {
          g.clear();
          g.ellipse(p.x, p.y + 2, 20, 4);
          g.fill({ color: 0x000000, alpha: 0.18 });
          g.roundRect(p.x - 17, p.y - 11, 34, 6, 1.5);
          g.fill(0x8b633f);
          g.roundRect(p.x - 17, p.y - 4, 34, 5, 1.5);
          g.fill(0xa97a4d);
          g.rect(p.x - 13, p.y, 3, 5);
          g.rect(p.x + 10, p.y, 3, 5);
          g.fill(0x3d4652);
        };
        return <pixiGraphics key={index} zIndex={isoDepth(bench.wx, bench.wy)} draw={draw} />;
      })}
    </>
  );
}

const ENTRANCE_SIGN_STYLE = new TextStyle({ fontSize: 13, fontWeight: "700", fill: 0xffffff, letterSpacing: 1 });

/** "Agentia" sign over the building's front entrance, like the reference's canopy. */
function EntranceSign() {
  const anchor = isoToScreen(13.5, GRID_ROWS);
  const metrics = CanvasTextMetrics.measureText("Agentia", ENTRANCE_SIGN_STYLE);
  const w = metrics.width + 24;
  const h = metrics.height + 8;
  const x = anchor.x - w / 2;
  const y = anchor.y - PARAPET_H - h - 6;
  const draw = (g: PixiGraphics) => {
    g.clear();
    g.roundRect(x, y, w, h, 4);
    g.fill({ color: 0x4a3b2f, alpha: 0.97 });
    g.rect(anchor.x - 2, y + h, 4, 8);
    g.fill({ color: 0x4a3b2f, alpha: 0.97 });
  };
  return (
    <>
      <pixiGraphics draw={draw} />
      <pixiText text="Agentia" x={anchor.x} y={y + 4} anchor={{ x: 0.5, y: 0 }} style={ENTRANCE_SIGN_STYLE} />
    </>
  );
}

/** Kairosoft-style name plate floating over each room. Anchored at the room's own center (not its
 * back wall, whose screen position is ambiguous between the room and its rear neighbor in iso),
 * and clamped to the stage so edge rooms' plates never clip off-screen. */
function RoomLabel({ area }: { area: AreaLayout }) {
  const text = `${area.icon} ${area.name}`;
  const metrics = CanvasTextMetrics.measureText(text, AREA_LABEL_STYLE);
  const anchor = USE_REALISTIC_SCENE
    ? realisticToScreen(area.gx + area.gw / 2, area.gy + area.gh / 2)
    : isoToScreen(area.gx + area.gw / 2, area.gy + area.gh / 2);
  const w = metrics.width + 16;
  const h = metrics.height + 8;
  const x = Math.min(Math.max(anchor.x - w / 2, 4), OFFICE_WIDTH - w - 4);
  const y = anchor.y - 44;
  const draw = (g: PixiGraphics) => {
    g.clear();
    g.roundRect(x + 2, y + 3, w, h, 6);
    g.fill({ color: 0x000000, alpha: 0.22 });
    g.roundRect(x, y, w, h, 6);
    g.fill({ color: shadeColor(area.color, 0.4), alpha: 0.96 });
    g.rect(x, y, 4, h);
    g.fill({ color: lightenColor(area.color, 0.72), alpha: 0.98 });
    g.roundRect(x, y, w, h, 6);
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.16 });
  };
  return (
    <>
      <pixiGraphics draw={draw} />
      <pixiText text={text} x={x + 8} y={y + 4} style={AREA_LABEL_STYLE} />
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
  g.stroke({ width: 3, color: 0xeaf2ff, alpha: 0.9 });
  g.poly([b.x, b.y, b.x - ux * 12 + -uy * 5, b.y - uy * 12 + ux * 5, b.x - ux * 12 - -uy * 5, b.y - uy * 12 - ux * 5]);
  g.fill({ color: 0xeaf2ff, alpha: 0.9 });
}

/** Corridor flow arrows + numbered step badges (reference image's ①〜⑤ workflow overlay). */
function FlowOverlay() {
  const drawLines = (g: PixiGraphics) => {
    g.clear();
    for (const line of FLOW_LINES) drawDashedWorldLine(g, line.from, line.to);
  };
  return (
    <>
      <pixiGraphics draw={drawLines} />
      {FLOW_STEPS.map((step) => {
        const p = isoToScreen(step.wx, step.wy);
        const drawBadge = (g: PixiGraphics) => {
          g.clear();
          g.circle(p.x, p.y, 10);
          g.fill(0x2f6fed);
          g.stroke({ width: 2, color: 0xffffff });
        };
        return (
          <pixiContainer key={step.n}>
            <pixiGraphics draw={drawBadge} />
            <pixiText text={step.n} x={p.x} y={p.y} anchor={0.5} style={STEP_NUMBER_STYLE} />
            <pixiText text={step.label} x={p.x + 15} y={p.y} anchor={{ x: 0, y: 0.5 }} style={STEP_LABEL_STYLE} />
          </pixiContainer>
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
 * isometric diorama on PixiJS v8 - WebGPU-first (automatic WebGL fallback), diamond floor grid,
 * height-cut walls with painter's-algorithm occlusion, and A*-driven walking characters.
 */
export function OfficeCanvas() {
  // v8's Assets loader fetches every sprite up front; the stage mounts only once the cache is warm
  // so all texture lookups inside the tree are synchronous.
  const [assetsReady, setAssetsReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    loadOfficeAssets().then(() => {
      if (mounted) setAssetsReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!assetsReady) {
    return <div style={{ width: OFFICE_WIDTH, height: OFFICE_HEIGHT, background: "#1e222c" }} />;
  }

  if (USE_REALISTIC_SCENE) {
    const labeledAreas = PHASE2_AREA_LAYOUT.filter(
      (area) => area.row === 0 || area.areaId === "server_room" || area.areaId === "github_hub"
    );
    return (
      <Application
        width={OFFICE_WIDTH}
        height={OFFICE_HEIGHT}
        backgroundColor={CANVAS_BACKGROUND}
        antialias
        preference="webgl"
      >
        <pixiContainer sortableChildren>
          <RealisticOfficeBackground />
          <CharacterLayer />
        </pixiContainer>
        <pixiContainer>
          {labeledAreas.map((area) => (
            <RoomLabel key={`realistic-label-${area.areaId}`} area={area} />
          ))}
        </pixiContainer>
      </Application>
    );
  }

  return (
    <Application
      width={OFFICE_WIDTH}
      height={OFFICE_HEIGHT}
      backgroundColor={CANVAS_BACKGROUND}
      antialias={false}
      preference="webgpu"
    >
      <pixiContainer sortableChildren>
        <BaseFloor />
        {PHASE2_AREA_LAYOUT.map((area) => (
          <RoomFloor key={`floor-${area.areaId}`} area={area} />
        ))}
        <CorridorDetails />
        {PHASE2_AREA_LAYOUT.map((area) => (
          <RoomWalls key={`walls-${area.areaId}`} area={area} />
        ))}
        {PHASE2_AREA_LAYOUT.map((area) => (
          <RoomFixtures key={`fixtures-${area.areaId}`} area={area} />
        ))}
        {PHASE2_AREA_LAYOUT.map((area) => (
          <ExteriorWindows key={`win-${area.areaId}`} area={area} />
        ))}
        {PHASE2_AREA_LAYOUT.map((area) => (
          <AreaFurniture key={`furniture-${area.areaId}`} area={area} />
        ))}
        {PHASE2_AREA_LAYOUT.map((area) => (
          <AreaDecor key={`decor-${area.areaId}`} area={area} />
        ))}
        <ExteriorTrees />
        <ExteriorFixtures />
        <CharacterLayer />
      </pixiContainer>
      <pixiContainer>
        <FlowOverlay />
        <EntranceSign />
        {PHASE2_AREA_LAYOUT.map((area) => (
          <RoomLabel key={`label-${area.areaId}`} area={area} />
        ))}
      </pixiContainer>
    </Application>
  );
}
