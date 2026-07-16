"use client";

import { Stage, Container, Graphics, Text } from "@pixi/react";
import { TextStyle, type Graphics as PixiGraphics } from "pixi.js";
import { useOfficeStore } from "@/stores/office-store";
import { areaSlots, OFFICE_HEIGHT, OFFICE_WIDTH, PHASE2_AREA_LAYOUT, type AreaLayout } from "../map/map";
import { CharacterSprite } from "../characters/CharacterSprite";

const AREA_LABEL_STYLE = new TextStyle({ fontSize: 12, fill: 0x1a1d23, fontWeight: "600" });

/** Empty desk/workstation decor drawn at every slot so a room still reads as a workspace when nobody's in it. */
function AreaFurniture({ area }: { area: AreaLayout }) {
  const draw = (g: PixiGraphics) => {
    g.clear();
    for (const slot of areaSlots(area.areaId)) {
      g.beginFill(area.color, 0.28);
      g.drawRoundedRect(slot.x - 10, slot.y - 7, 20, 14, 3);
      g.endFill();
    }
  };
  return <Graphics draw={draw} />;
}

function AreaTile({ area }: { area: AreaLayout }) {
  const draw = (g: PixiGraphics) => {
    g.clear();
    g.beginFill(area.color, 0.14);
    g.lineStyle(1.5, area.color, 0.9);
    g.drawRoundedRect(area.x, area.y, area.width, area.height, 10);
    g.endFill();
  };
  return (
    <>
      <Graphics draw={draw} />
      <AreaFurniture area={area} />
      <Text text={`${area.icon} ${area.name}`} x={area.x + 10} y={area.y + 8} style={AREA_LABEL_STYLE} />
    </>
  );
}

function OfficeFloor() {
  return (
    <>
      {PHASE2_AREA_LAYOUT.map((area) => (
        <AreaTile key={area.areaId} area={area} />
      ))}
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

/** docs/10_OFFICE_SYSTEM.md: fixed single-floor office (Phase 2: full 12 areas) rendered with PixiJS (docs/03 #4 tech choice). */
export function OfficeCanvas() {
  return (
    <Stage width={OFFICE_WIDTH} height={OFFICE_HEIGHT} options={{ backgroundColor: 0xf4f5f7, antialias: true }}>
      <Container>
        <OfficeFloor />
        <CharacterLayer />
      </Container>
    </Stage>
  );
}
