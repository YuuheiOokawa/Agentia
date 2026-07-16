"use client";

import { useRef } from "react";
import { Container, Graphics, Sprite, Text } from "@pixi/react";
import { useTick } from "@pixi/react";
import { TextStyle, type Container as PixiContainer, type Graphics as PixiGraphics, type Sprite as PixiSprite } from "pixi.js";
import type { AreaId, Employee } from "@agentia/shared-types";
import { areaSlotFor, areaWanderBounds, pathToArea } from "../map/map";
import { CHARACTER_TEXTURES, poseForState, type Facing } from "../pixel-assets";

const WALK_SPEED_PX_PER_MS = 0.09;
const ARRIVAL_EPSILON_PX = 1.5;
/** docs/10_OFFICE_SYSTEM.md #6 (liveliness): idle/waiting/completed characters roam their whole room
 * every few seconds instead of standing frozen at their desk - this is purely a rendering-layer
 * flourish, not store state. */
const WANDER_MIN_DELAY_MS = 1500;
const WANDER_MAX_DELAY_MS = 4000;
/** Below this vertical speed, a moving character keeps its current facing instead of flickering
 * between front/back on near-horizontal movement. */
const FACING_DEADZONE_PX = 1.5;

/** Raw sprites are a 24x30 pixel-art grid rasterized at 5x (docs: real bitmap assets, not vector shapes).
 * 0.272 (not 0.34) keeps the on-screen footprint the same as the old 16x20@6x sprites (120*0.272 == 96*0.34),
 * since the larger source art is meant to add detail, not make characters bigger relative to desks/rooms. */
const SPRITE_SCALE = 0.272;

const ICON_STYLE = new TextStyle({ fontSize: 13 });
const NAME_STYLE = new TextStyle({ fontSize: 11, fill: 0x1a1d23, fontWeight: "600" });
const TASK_STYLE = new TextStyle({ fontSize: 10, fill: 0x6b7280, wordWrap: true, wordWrapWidth: 150 });

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

const STATE_ICON: Record<string, string> = {
  idle: "",
  moving: "",
  researching: "🔍",
  reading: "📖",
  planning: "🗂",
  coding: "⌨️",
  terminal: "🖥",
  testing: "🧪",
  deploying: "🚀",
  waiting: "💬",
  error: "⚠️",
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
  const initialPos = useRef(areaSlotFor(employee.areaId, employee.agentId)).current;

  const outerRef = useRef<PixiContainer | null>(null);
  const bodyGroupRef = useRef<PixiContainer | null>(null);
  const bodySpriteRef = useRef<PixiSprite | null>(null);
  const detailsSpriteRef = useRef<PixiSprite | null>(null);
  const posRef = useRef({ ...initialPos });
  const pathRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastAreaIdRef = useRef<AreaId>(employee.areaId);
  const wanderDeadlineRef = useRef<number>(Date.now() + WANDER_MIN_DELAY_MS + Math.random() * 1500);
  const clockRef = useRef(Math.random() * 1000);
  /** Which way the character last faced - "back" while walking up/away, "front" otherwise. */
  const facingRef = useRef<Facing>("front");

  useTick((delta) => {
    clockRef.current += delta;

    if (employee.areaId !== lastAreaIdRef.current) {
      pathRef.current = pathToArea(lastAreaIdRef.current, employee.areaId, employee.agentId);
      lastAreaIdRef.current = employee.areaId;
      wanderDeadlineRef.current = Date.now() + WANDER_MIN_DELAY_MS + Math.random() * (WANDER_MAX_DELAY_MS - WANDER_MIN_DELAY_MS);
    }

    let moving = false;
    const next = pathRef.current[0];
    if (next) {
      const dist = distance(posRef.current, next);
      if (dist < ARRIVAL_EPSILON_PX) {
        pathRef.current = pathRef.current.slice(1);
      } else {
        moving = true;
        const dy = next.y - posRef.current.y;
        if (dy < -FACING_DEADZONE_PX) facingRef.current = "back";
        else if (dy > FACING_DEADZONE_PX) facingRef.current = "front";
        const step = Math.min(dist, WALK_SPEED_PX_PER_MS * delta * 16.6667);
        const ratio = step / dist;
        posRef.current = {
          x: posRef.current.x + (next.x - posRef.current.x) * ratio,
          y: posRef.current.y + (next.y - posRef.current.y) * ratio,
        };
      }
    } else if (WANDERABLE_STATES.has(employee.state) && Date.now() > wanderDeadlineRef.current) {
      const bounds = areaWanderBounds(employee.areaId);
      pathRef.current = [{ x: bounds.x + Math.random() * bounds.width, y: bounds.y + Math.random() * bounds.height }];
      wanderDeadlineRef.current = Date.now() + WANDER_MIN_DELAY_MS + Math.random() * (WANDER_MAX_DELAY_MS - WANDER_MIN_DELAY_MS);
    }

    if (!moving) facingRef.current = "front";

    if (outerRef.current) {
      outerRef.current.position.set(posRef.current.x, posRef.current.y);
    }
    if (bodyGroupRef.current) {
      const t = clockRef.current * 0.001;
      if (moving) {
        bodyGroupRef.current.scale.set(SPRITE_SCALE, SPRITE_SCALE * (1 + Math.sin(t * 26) * 0.06));
        bodyGroupRef.current.position.y = 3 + Math.abs(Math.sin(t * 13)) * -3;
      } else {
        bodyGroupRef.current.scale.set(SPRITE_SCALE, SPRITE_SCALE * (1 + Math.sin(t * 2.4) * 0.02));
        bodyGroupRef.current.position.y = 3;
      }
    }

    const facedTextures = CHARACTER_TEXTURES[poseForState(employee.state)][facingRef.current];
    if (bodySpriteRef.current) bodySpriteRef.current.texture = facedTextures.body;
    if (detailsSpriteRef.current) detailsSpriteRef.current.texture = facedTextures.details;
  });

  const tint = shadeColor(ROLE_COLOR[employee.role] ?? ROLE_COLOR["generic"] ?? 0x757575, employee.avatarVariant);
  const icon = STATE_ICON[employee.state] ?? "";
  const pose = poseForState(employee.state);
  const textures = CHARACTER_TEXTURES[pose][facingRef.current];

  const drawShadow = (g: PixiGraphics) => {
    g.clear();
    g.beginFill(0x000000, 0.18);
    g.drawEllipse(0, 4, 11, 4);
    g.endFill();
  };

  return (
    <Container ref={outerRef}>
      <Graphics draw={drawShadow} />
      <Container ref={bodyGroupRef}>
        {/* Two-layer pixel-art sprite: a tintable "shirt" bitmap under a fixed-color details bitmap
            (hair/skin/eyes/pants), so per-role/avatar tinting never discolors skin or hair. */}
        <Sprite ref={bodySpriteRef} texture={textures.body} anchor={{ x: 0.5, y: 1 }} tint={tint} />
        <Sprite ref={detailsSpriteRef} texture={textures.details} anchor={{ x: 0.5, y: 1 }} />
      </Container>
      {icon && <Text text={icon} x={-7} y={-50} style={ICON_STYLE} />}
      <Text text={employee.displayName} x={0} y={16} anchor={0.5} style={NAME_STYLE} />
      {employee.currentTask && <Text text={employee.currentTask} x={0} y={30} anchor={0.5} style={TASK_STYLE} />}
    </Container>
  );
}
