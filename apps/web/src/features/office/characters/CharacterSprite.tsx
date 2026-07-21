"use client";

import { useCallback, useRef } from "react";
import { extend, useTick } from "@pixi/react";
import {
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  type Container as PixiContainer,
  type Graphics as PixiGraphics,
  type Sprite as PixiSprite,
} from "pixi.js";
import type { AreaId, Employee } from "@agentia/shared-types";
import { useOfficeStore } from "@/stores/office-store";
import { areaSlotFor } from "../map/map";
import { findPath } from "../map/pathfinding";
import { isoDepth, realisticToScreen } from "../map/iso";
import { poseForState, realisticCharacterTexture, type Facing } from "../pixel-assets";
import {
  AMBIENT_PAUSE_MAX_MS,
  AMBIENT_PAUSE_MIN_MS,
  AMBIENT_TRIP_CHANCE,
  pickBreakSpot,
  pickWanderTarget,
  type AmbientState,
} from "./behavior";

extend({ Container, Graphics, Sprite, Text });

/** Movement happens in WORLD (tile) units over A* waypoints (pathfinding.ts); rendering converts per tick. */
const WALK_SPEED_TILES_PER_MS = 0.005;
const ARRIVAL_EPSILON_TILES = 0.08;
/** Time to ramp from a standstill to full walk speed - an instant 0-to-full-speed step reads as
 * a teleport-ish twitch, especially over the short hops between adjacent desks. */
const ACCEL_RAMP_MS = 260;
/** Distance-to-goal (tiles) over which the character eases into its final stop, only on the last
 * leg of a path - intermediate waypoints (mid-corridor turns) keep full speed so a straight
 * corridor walk still glides in one motion instead of braking at every compressed waypoint. */
const DECEL_TILES = 0.55;
const MIN_SPEED_FACTOR = 0.28;
/** docs/10_OFFICE_SYSTEM.md #6 (liveliness): idle/waiting/completed characters roam every few
 * seconds instead of standing frozen - purely a rendering-layer flourish, not store state. */
const WANDER_MIN_DELAY_MS = 1500;
const WANDER_MAX_DELAY_MS = 4500;
/** World-space deadzone below which the facing/mirror keeps its previous value, so near-diagonal
 * movement doesn't flicker between front/back or left/right every frame. */
const DIRECTION_DEADZONE = 0.25;

/** Generated 3D employee cells are 307x512; this produces a roughly 62px-tall office figure. */
const SPRITE_SCALE = 0.13;

/** Walk-cycle frame rate: the sprite alternates walk1/walk2 in sync with the bounce (t * 13 rad/s
 * ~= 2 steps per second), the classic Kairosoft two-frame shuffle. */
const WALK_CYCLE_RATE = 13;

const ICON_STYLE = new TextStyle({ fontSize: 12 });
const NAME_STYLE = new TextStyle({
  fontSize: 10,
  fill: 0x1a1d23,
  fontWeight: "600",
  stroke: { color: 0xffffff, width: 3 },
});

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

export function CharacterSprite({ employee }: { employee: Employee }) {
  const selectEmployee = useOfficeStore((s) => s.selectEmployee);
  const initialPos = useRef(areaSlotFor(employee.areaId, employee.agentId)).current;

  const outerRef = useRef<PixiContainer | null>(null);
  const bodyGroupRef = useRef<PixiContainer | null>(null);
  const characterSpriteRef = useRef<PixiSprite | null>(null);
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
  /** 0..1 ease-in ramp since the current walk began; reset to 0 the instant the character stops. */
  const speedRampRef = useRef(0);
  /** Actual current speed as a 0..1 fraction of full walk speed (accel ramp x arrival decel) -
   * drives the walk-cycle bounce amplitude so the feet don't flutter at full amplitude while the
   * body is still easing in/out (a mismatch that reads as feet sliding under a slow-moving body). */
  const currentSpeedFactorRef = useRef(0);

  useTick((ticker) => {
    const delta = ticker.deltaTime;
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

        // Ease in from a standstill, ease out into the final stop (last leg only) - see
        // ACCEL_RAMP_MS/DECEL_TILES above for why intermediate waypoints skip the ease-out.
        speedRampRef.current = Math.min(1, speedRampRef.current + (delta * 16.6667) / ACCEL_RAMP_MS);
        const accelFactor = speedRampRef.current * (2 - speedRampRef.current); // ease-out-quad ramp-up
        const isFinalLeg = pathRef.current.length === 1;
        const decelFactor = isFinalLeg ? Math.max(MIN_SPEED_FACTOR, Math.min(1, dist / DECEL_TILES)) : 1;
        const speedFactor = accelFactor * decelFactor;
        currentSpeedFactorRef.current = speedFactor;

        const step = Math.min(dist, WALK_SPEED_TILES_PER_MS * delta * 16.6667 * speedFactor);
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
    if (!moving) {
      facingRef.current = poseForState(employee.state) === "working" ? "back" : "front";
      speedRampRef.current = 0; // next walk starts the ease-in fresh, not mid-ramp.
      currentSpeedFactorRef.current = 0;
    }

    if (outerRef.current) {
      const screen = realisticToScreen(posRef.current.x, posRef.current.y);
      outerRef.current.position.set(screen.x, screen.y);
      // Live painter's-algorithm depth so the character sorts correctly against walls/furniture.
      outerRef.current.zIndex = isoDepth(posRef.current.x, posRef.current.y) + 0.02;
    }

    const t = clockRef.current * 0.001;
    /** 0..1 walk-cycle phase while moving, scaled by the current speed factor so a character
     * easing into/out of a step doesn't flap its feet at full amplitude while barely gliding -
     * settling to neutral when stopped. */
    const stepPhase = moving ? Math.abs(Math.sin(t * WALK_CYCLE_RATE)) * currentSpeedFactorRef.current : 0;

    if (bodyGroupRef.current) {
      const sx = SPRITE_SCALE * mirrorRef.current;
      if (moving) {
        const swayAmount = currentSpeedFactorRef.current;
        bodyGroupRef.current.scale.set(sx, SPRITE_SCALE * (1 + Math.sin(t * WALK_CYCLE_RATE * 2) * 0.04 * swayAmount));
        bodyGroupRef.current.position.y = 2 - stepPhase * 2.5;
        bodyGroupRef.current.position.x = Math.sin(t * WALK_CYCLE_RATE) * 1.4 * swayAmount;
      } else {
        bodyGroupRef.current.scale.set(sx, SPRITE_SCALE * (1 + Math.sin(t * 2.4) * 0.02));
        bodyGroupRef.current.position.y = 2;
        bodyGroupRef.current.position.x = 0;
      }
    }
    if (shadowRef.current) {
      const shadowScale = 1 - stepPhase * 0.18;
      shadowRef.current.clear();
      shadowRef.current.ellipse(0, 2, 10 * shadowScale, 4 * shadowScale);
      shadowRef.current.fill({ color: 0x000000, alpha: 0.2 });
    }

    // The realistic sheet provides matched front/back renders. Movement still uses the existing
    // bounce and sway, while facing swaps the appropriate high-resolution crop.
    if (characterSpriteRef.current) {
      characterSpriteRef.current.texture = realisticCharacterTexture(employee.avatarVariant, facingRef.current);
    }
  });

  const icon = STATE_ICON[employee.state] ?? "";
  const texture = realisticCharacterTexture(employee.avatarVariant, facingRef.current);

  const drawShadow = (g: PixiGraphics) => {
    g.clear();
    g.ellipse(0, 2, 10, 4);
    g.fill({ color: 0x000000, alpha: 0.2 });
  };

  /** STEP10: white speech bubble with a tail, holding the state icon above the head. */
  const drawBubble = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      if (!icon) return;
      g.roundRect(-11, -62, 22, 20, 7);
      g.fill({ color: 0xffffff, alpha: 0.96 });
      g.stroke({ width: 1, color: 0xb9bec9 });
      g.poly([-4, -43, 4, -43, 0, -37]);
      g.fill({ color: 0xffffff, alpha: 0.96 });
    },
    [icon]
  );

  const handleTap = useCallback(() => selectEmployee(employee.agentId), [selectEmployee, employee.agentId]);

  return (
    <pixiContainer
      ref={outerRef}
      zIndex={isoDepth(initialPos.x, initialPos.y) + 0.02}
      eventMode="static"
      cursor="pointer"
      onPointerDown={handleTap}
    >
      <pixiGraphics ref={shadowRef} draw={drawShadow} />
      <pixiContainer ref={bodyGroupRef}>
        <pixiSprite ref={characterSpriteRef} texture={texture} anchor={{ x: 0.5, y: 1 }} />
      </pixiContainer>
      <pixiGraphics draw={drawBubble} />
      {icon && <pixiText text={icon} x={0} y={-52} anchor={0.5} style={ICON_STYLE} />}
      <pixiText text={employee.displayName} x={0} y={7} anchor={{ x: 0.5, y: 0 }} style={NAME_STYLE} />
    </pixiContainer>
  );
}
