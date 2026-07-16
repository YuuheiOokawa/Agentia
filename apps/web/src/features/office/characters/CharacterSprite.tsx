"use client";

import { useRef } from "react";
import { Container, Graphics, Text } from "@pixi/react";
import { useTick } from "@pixi/react";
import { TextStyle, type Container as PixiContainer, type Graphics as PixiGraphics } from "pixi.js";
import type { AreaId, Employee } from "@agentia/shared-types";
import { areaSlotFor, pathToArea } from "../map/map";

const WALK_SPEED_PX_PER_MS = 0.09;
const ARRIVAL_EPSILON_PX = 1.5;
/** docs/10_OFFICE_SYSTEM.md #6 (liveliness): idle/completed characters take a short stroll near their desk
 * every few seconds instead of standing frozen - this is purely a rendering-layer flourish, not store state. */
const WANDER_MIN_DELAY_MS = 2200;
const WANDER_MAX_DELAY_MS = 5200;
const WANDER_RADIUS_PX = 22;

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

const WANDERABLE_STATES = new Set(["idle", "completed"]);

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
  const posRef = useRef({ ...initialPos });
  const pathRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastAreaIdRef = useRef<AreaId>(employee.areaId);
  const wanderDeadlineRef = useRef<number>(Date.now() + WANDER_MIN_DELAY_MS + Math.random() * 1500);
  const clockRef = useRef(Math.random() * 1000);

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
        const step = Math.min(dist, WALK_SPEED_PX_PER_MS * delta * 16.6667);
        const ratio = step / dist;
        posRef.current = {
          x: posRef.current.x + (next.x - posRef.current.x) * ratio,
          y: posRef.current.y + (next.y - posRef.current.y) * ratio,
        };
      }
    } else if (WANDERABLE_STATES.has(employee.state) && Date.now() > wanderDeadlineRef.current) {
      const base = areaSlotFor(employee.areaId, employee.agentId);
      const angle = Math.random() * Math.PI * 2;
      const radius = WANDER_RADIUS_PX * (0.4 + Math.random() * 0.6);
      pathRef.current = [{ x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius }];
      wanderDeadlineRef.current = Date.now() + WANDER_MIN_DELAY_MS + Math.random() * (WANDER_MAX_DELAY_MS - WANDER_MIN_DELAY_MS);
    }

    if (outerRef.current) {
      outerRef.current.position.set(posRef.current.x, posRef.current.y);
    }
    if (bodyGroupRef.current) {
      const t = clockRef.current * 0.001;
      if (moving) {
        bodyGroupRef.current.scale.set(1, 1 + Math.sin(t * 26) * 0.06);
        bodyGroupRef.current.position.y = Math.abs(Math.sin(t * 13)) * -3;
      } else {
        bodyGroupRef.current.scale.set(1, 1 + Math.sin(t * 2.4) * 0.02);
        bodyGroupRef.current.position.y = 0;
      }
    }
  });

  const color = shadeColor(ROLE_COLOR[employee.role] ?? ROLE_COLOR["generic"] ?? 0x757575, employee.avatarVariant);
  const icon = STATE_ICON[employee.state] ?? "";

  const drawShadow = (g: PixiGraphics) => {
    g.clear();
    g.beginFill(0x000000, 0.16);
    g.drawEllipse(0, 15, 11, 4);
    g.endFill();
  };

  const drawBody = (g: PixiGraphics) => {
    g.clear();
    g.beginFill(color);
    g.lineStyle(2, employee.hasWarning ? 0xe53935 : 0xffffff, 1);
    g.drawRoundedRect(-8, -2, 16, 16, 6); // torso
    g.endFill();
    g.beginFill(shadeColor(color, 7));
    g.lineStyle(1.5, 0xffffff, 1);
    g.drawCircle(0, -10, 8); // head
    g.endFill();
  };

  return (
    <Container ref={outerRef}>
      <Graphics draw={drawShadow} />
      <Container ref={bodyGroupRef}>
        <Graphics draw={drawBody} />
        {icon && <Text text={icon} x={-7} y={-30} style={ICON_STYLE} />}
      </Container>
      <Text text={employee.displayName} x={0} y={22} anchor={0.5} style={NAME_STYLE} />
      {employee.currentTask && <Text text={employee.currentTask} x={0} y={36} anchor={0.5} style={TASK_STYLE} />}
    </Container>
  );
}
