"use client";

import { useEffect, useRef, useState } from "react";
import { Container, Graphics, Text } from "@pixi/react";
import { useTick } from "@pixi/react";
import { TextStyle, type Graphics as PixiGraphics } from "pixi.js";
import type { Employee } from "@agentia/shared-types";
import { areaCenter } from "../map/map";

const MOVE_SPEED_PX_PER_MS = 0.12;
const ICON_STYLE = new TextStyle({ fontSize: 14 });
const NAME_STYLE = new TextStyle({ fontSize: 11, fill: 0x1a1d23, fontWeight: "600" });
const TASK_STYLE = new TextStyle({ fontSize: 10, fill: 0x6b7280, wordWrap: true, wordWrapWidth: 140 });
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
  moving: "🚶",
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

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function CharacterSprite({ employee }: { employee: Employee }) {
  const target = areaCenter(employee.areaId);
  const [position, setPosition] = useState(target);
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    // Snap in from off-screen on first spawn only; otherwise let useTick lerp toward the new target.
  }, []);

  useTick((delta) => {
    const current = positionRef.current;
    const dist = distance(current, target);
    if (dist < 1) return;
    const step = Math.min(dist, MOVE_SPEED_PX_PER_MS * delta * 16.6667);
    const ratio = step / dist;
    const next = { x: current.x + (target.x - current.x) * ratio, y: current.y + (target.y - current.y) * ratio };
    setPosition(next);
  });

  const color = ROLE_COLOR[employee.role] ?? ROLE_COLOR["generic"] ?? 0x757575;
  const icon = STATE_ICON[employee.state] ?? "";

  const draw = (g: PixiGraphics) => {
    g.clear();
    g.beginFill(color);
    g.lineStyle(2, employee.hasWarning ? 0xe53935 : 0xffffff, 1);
    g.drawCircle(0, 0, 14);
    g.endFill();
  };

  return (
    <Container x={position.x} y={position.y}>
      <Graphics draw={draw} />
      {icon && <Text text={icon} x={-8} y={-34} style={ICON_STYLE} />}
      <Text text={employee.displayName} x={0} y={20} anchor={0.5} style={NAME_STYLE} />
      {employee.currentTask && <Text text={employee.currentTask} x={0} y={34} anchor={0.5} style={TASK_STYLE} />}
    </Container>
  );
}
