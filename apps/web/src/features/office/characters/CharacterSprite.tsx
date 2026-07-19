"use client";

import { useCallback, useRef } from "react";
import { Container, Graphics, Sprite, Text } from "@pixi/react";
import { useTick } from "@pixi/react";
import { TextStyle, type Container as PixiContainer, type Graphics as PixiGraphics, type Sprite as PixiSprite } from "pixi.js";
import type { AreaId, Employee } from "@agentia/shared-types";
import { useOfficeStore } from "@/stores/office-store";
import { areaSlotFor } from "../map/map";
import { findPath } from "../map/pathfinding";
import { isoDepth, isoToScreen } from "../map/iso";
import { characterTextures, poseForState, type Facing } from "../pixel-assets";
import {
  AMBIENT_PAUSE_MAX_MS,
  AMBIENT_PAUSE_MIN_MS,
  AMBIENT_TRIP_CHANCE,
  pickBreakSpot,
  pickWanderTarget,
  type AmbientState,
} from "./behavior";

/** Movement happens in WORLD (tile) units over A* waypoints (pathfinding.ts); rendering converts per tick. */
const WALK_SPEED_TILES_PER_MS = 0.005;
const ARRIVAL_EPSILON_TILES = 0.08;
/** docs/10_OFFICE_SYSTEM.md #6 (liveliness): idle/waiting/completed characters roam every few
 * seconds instead of standing frozen - purely a rendering-layer flourish, not store state. */
const WANDER_MIN_DELAY_MS = 1500;
const WANDER_MAX_DELAY_MS = 4500;
/** World-space deadzone below which the facing/mirror keeps its previous value, so near-diagonal
 * movement doesn't flicker between front/back or left/right every frame. */
const DIRECTION_DEADZONE = 0.25;

/** Raw sprites are a 24x30 pixel-art grid rasterized at 5x; scaled so a character stands about
 * 1.5 tiles tall on the iso floor - roughly Kairosoft's character-to-desk proportion. */
const SPRITE_SCALE = 0.26;

const ICON_STYLE = new TextStyle({ fontSize: 12 });
const NAME_STYLE = new TextStyle({ fontSize: 10, fill: 0x1a1d23, fontWeight: "600", stroke: 0xffffff, strokeThickness: 3 });

const ROLE_COLOR: Record<string, number> = {
  main: 0x1e88e5,
  explore: 0x5c6bc0,
  plan: 0x8e24aa,
  implementation: 0x1e88e5,
  test: 0x43a047,
  devops: 0xf4511e,
  github: 0x263238,
  generic: 0x757575,
};

/** STEP10: what the speech bubble above the head shows per state (empty = no bubble). */
const STATE_ICON: Record<string, string> = {
  idle: "",
  moving: "",
  researching: "🔍",
  reading: "📖",
  planning: "💭",
  coding: "⌨️",
  terminal: "🖥",
  testing: "🧪",
  deploying: "🚀",
  waiting: "💬",
  error: "❗",
  completed: "✅",
};

const WANDERABLE_STATES = new Set(["idle", "waiting", "completed"]);

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Shifts a base role color's brightness by avatarVariant (0-7) so coworkers sharing a role are still distinguishable. */
function shadeColor(base: number, variant: number): number {
  const factor = 0.78 + (variant % 8) * 0.06; // 0.78 .. 1.20
  const r = Math.min(255, Math.round(((base >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((base >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((base & 0xff) * factor));
  return (r << 16) + (g << 8) + b;
}

export function CharacterSprite({ employee }: { employee: Employee }) {
  const selectEmployee = useOfficeStore((s) => s.selectEmployee);
  const initialPos = useRef(areaSlotFor(employee.areaId, employee.agentId)).current;

  const outerRef = useRef<PixiContainer | null>(null);
  const bodyGroupRef = useRef<PixiContainer | null>(null);
  const bodySpriteRef = useRef<PixiSprite | null>(null);
  const detailsSpriteRef = useRef<PixiSprite | null>(null);
  const shadowRef = useRef<PixiGraphics | null>(null);
  /** Current position in world tiles. */
  const posRef = useRef({ ...initialPos });
  /** A* waypoints (world tiles) still to visit. */
  const pathRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastAreaIdRef = useRef<AreaId>(employee.areaId);
  const wanderDeadlineRef = useRef<number>(Date.now() + WANDER_MIN_DELAY_MS + Math.random() * 1500);
  const clockRef = useRef(Math.random() * 1000);
  /** "back" while walking away from the viewer (screen-up), "front" otherwise. */
  const facingRef = useRef<Facing>("front");
  /** -1 mirrors the sprite while walking screen-left, +1 while walking screen-right. */
  const mirrorRef = useRef<1 | -1>(1);
  /** STEP9 ambient stroll (break-room trip) progress - rendering-layer only. */
  const ambientRef = useRef<AmbientState>({ phase: "none", until: 0 });

  useTick((delta) => {
    clockRef.current += delta;
    const now = Date.now();

    // A REAL destination change (Claude Code event moved this employee) always wins: abandon any
    // ambient stroll and plan an A* path from wherever the character physically is right now -
    // never a teleport (STEP2 forbidden list).
    if (employee.areaId !== lastAreaIdRef.current) {
      lastAreaIdRef.current = employee.areaId;
      ambientRef.current = { phase: "none", until: 0 };
      pathRef.current = findPath(posRef.current, areaSlotFor(employee.areaId, employee.agentId));
      wanderDeadlineRef.current = now + WANDER_MIN_DELAY_MS + Math.random() * (WANDER_MAX_DELAY_MS - WANDER_MIN_DELAY_MS);
    }

    let moving = false;
    const next = pathRef.current[0];
    if (next) {
      const dist = distance(posRef.current, next);
      if (dist < ARRIVAL_EPSILON_TILES) {
        pathRef.current = pathRef.current.slice(1);
        if (pathRef.current.length === 0) {
          // Arrival hooks for the ambient stroll state machine.
          if (ambientRef.current.phase === "going") {
            ambientRef.current = {
              phase: "away",
              until: now + AMBIENT_PAUSE_MIN_MS + Math.random() * (AMBIENT_PAUSE_MAX_MS - AMBIENT_PAUSE_MIN_MS),
            };
          } else if (ambientRef.current.phase === "returning") {
            ambientRef.current = { phase: "none", until: 0 };
          }
        }
      } else {
        moving = true;
        const dx = next.x - posRef.current.x;
        const dy = next.y - posRef.current.y;
        // Screen-vertical component of the direction is (dx+dy), screen-horizontal is (dx-dy).
        const screenDown = dx + dy;
        const screenRight = dx - dy;
        if (screenDown < -DIRECTION_DEADZONE) facingRef.current = "back";
        else if (screenDown > DIRECTION_DEADZONE) facingRef.current = "front";
        if (screenRight < -DIRECTION_DEADZONE) mirrorRef.current = -1;
        else if (screenRight > DIRECTION_DEADZONE) mirrorRef.current = 1;
        const step = Math.min(dist, WALK_SPEED_TILES_PER_MS * delta * 16.6667);
        const ratio = step / dist;
        posRef.current = { x: posRef.current.x + dx * ratio, y: posRef.current.y + dy * ratio };
      }
    } else if (WANDERABLE_STATES.has(employee.state) && now > wanderDeadlineRef.current) {
      const ambient = ambientRef.current;
      if (ambient.phase === "away") {
        if (now >= ambient.until) {
          // Done lingering in the break room - stroll back to the own seat.
          pathRef.current = findPath(posRef.current, areaSlotFor(employee.areaId, employee.agentId));
          ambientRef.current = { phase: "returning", until: 0 };
        }
      } else if (employee.areaId !== "break_room" && Math.random() < AMBIENT_TRIP_CHANCE) {
        // STEP9: take a break - walk to the break room (vending machine / water server / couches).
        const spot = pickBreakSpot();
        if (spot) {
          pathRef.current = findPath(posRef.current, spot);
          ambientRef.current = { phase: "going", until: 0 };
        }
      } else {
        // Look around the own room a little.
        const target = pickWanderTarget(employee.areaId);
        if (target) pathRef.current = findPath(posRef.current, target);
      }
      wanderDeadlineRef.current = now + WANDER_MIN_DELAY_MS + Math.random() * (WANDER_MAX_DELAY_MS - WANDER_MIN_DELAY_MS);
    }

    // Stationary characters in a working state face their desk (we see their back, seated at the
    // monitor); everyone else turns toward the viewer.
    if (!moving) facingRef.current = poseForState(employee.state) === "working" ? "back" : "front";

    if (outerRef.current) {
      const screen = isoToScreen(posRef.current.x, posRef.current.y);
      outerRef.current.position.set(screen.x, screen.y);
      // Live painter's-algorithm depth so the character sorts correctly against walls/furniture.
      outerRef.current.zIndex = isoDepth(posRef.current.x, posRef.current.y) + 0.02;
    }

    const t = clockRef.current * 0.001;
    /** 0..1 walk-cycle phase while moving, so the bounce/sway/shadow-squash all stay in lockstep
     * (a proper "footstep" feel instead of independent wobbles), and settle back to neutral (0)
     * the instant the character stops. */
    const stepPhase = moving ? Math.abs(Math.sin(t * 13)) : 0;

    if (bodyGroupRef.current) {
      const sx = SPRITE_SCALE * mirrorRef.current;
      if (moving) {
        bodyGroupRef.current.scale.set(sx, SPRITE_SCALE * (1 + Math.sin(t * 26) * 0.06));
        bodyGroupRef.current.position.y = 2 - stepPhase * 3;
        bodyGroupRef.current.position.x = Math.sin(t * 13) * 1.6;
      } else {
        bodyGroupRef.current.scale.set(sx, SPRITE_SCALE * (1 + Math.sin(t * 2.4) * 0.02));
        bodyGroupRef.current.position.y = 2;
        bodyGroupRef.current.position.x = 0;
      }
    }
    if (shadowRef.current) {
      const shadowScale = 1 - stepPhase * 0.18;
      shadowRef.current.clear();
      shadowRef.current.beginFill(0x000000, 0.2);
      shadowRef.current.drawEllipse(0, 2, 10 * shadowScale, 4 * shadowScale);
      shadowRef.current.endFill();
    }

    // While walking, always use the neutral idle pose (no typing-in-midair); the state pose
    // applies once the character has arrived (STEP4: walk animation distinct from work animation).
    const pose = moving ? "idle" : poseForState(employee.state);
    const facedTextures = characterTextures(employee.avatarVariant, pose, facingRef.current);
    if (bodySpriteRef.current) bodySpriteRef.current.texture = facedTextures.body;
    if (detailsSpriteRef.current) detailsSpriteRef.current.texture = facedTextures.details;
  });

  const tint = shadeColor(ROLE_COLOR[employee.role] ?? ROLE_COLOR["generic"] ?? 0x757575, employee.avatarVariant);
  const icon = STATE_ICON[employee.state] ?? "";
  const pose = poseForState(employee.state);
  const textures = characterTextures(employee.avatarVariant, pose, facingRef.current);

  const drawShadow = (g: PixiGraphics) => {
    g.clear();
    g.beginFill(0x000000, 0.2);
    g.drawEllipse(0, 2, 10, 4);
    g.endFill();
  };

  /** STEP10: white speech bubble with a tail, holding the state icon above the head. */
  const drawBubble = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      if (!icon) return;
      g.lineStyle(1, 0xb9bec9, 1);
      g.beginFill(0xffffff, 0.96);
      g.drawRoundedRect(-11, -62, 22, 20, 7);
      g.endFill();
      g.lineStyle(0);
      g.beginFill(0xffffff, 0.96);
      g.drawPolygon([-4, -43, 4, -43, 0, -37]);
      g.endFill();
    },
    [icon]
  );

  const handleTap = useCallback(() => selectEmployee(employee.agentId), [selectEmployee, employee.agentId]);

  return (
    <Container
      ref={outerRef}
      zIndex={isoDepth(initialPos.x, initialPos.y) + 0.02}
      eventMode="static"
      cursor="pointer"
      pointerdown={handleTap}
    >
      <Graphics ref={shadowRef} draw={drawShadow} />
      <Container ref={bodyGroupRef}>
        {/* Two-layer pixel-art sprite: a tintable "shirt" bitmap under a fixed-color details bitmap
            (hair/skin/eyes/pants), so per-role/avatar tinting never discolors skin or hair. */}
        <Sprite ref={bodySpriteRef} texture={textures.body} anchor={{ x: 0.5, y: 1 }} tint={tint} />
        <Sprite ref={detailsSpriteRef} texture={textures.details} anchor={{ x: 0.5, y: 1 }} />
      </Container>
      <Graphics draw={drawBubble} />
      {icon && <Text text={icon} x={0} y={-52} anchor={0.5} style={ICON_STYLE} />}
      <Text text={employee.displayName} x={0} y={7} anchor={{ x: 0.5, y: 0 }} style={NAME_STYLE} />
    </Container>
  );
}
