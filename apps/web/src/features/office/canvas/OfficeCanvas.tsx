"use client";

import { Stage, Container, Sprite, TilingSprite, Text } from "@pixi/react";
import { TextStyle } from "pixi.js";
import { useOfficeStore } from "@/stores/office-store";
import { lightenColor, shadeColor } from "@/lib/color";
import { AREA_FURNITURE, areaSlots, OFFICE_HEIGHT, OFFICE_WIDTH, PHASE2_AREA_LAYOUT, type AreaLayout } from "../map/map";
import { CharacterSprite } from "../characters/CharacterSprite";
import { FLOOR_TEXTURE, FURNITURE_TEXTURES, WALL_TEXTURE } from "../pixel-assets";

const AREA_LABEL_STYLE = new TextStyle({
  fontSize: 12,
  fontWeight: "700",
  fill: 0xffffff,
  stroke: 0x000000,
  strokeThickness: 3,
});

const WALL_HEIGHT = 22;
const FURNITURE_SCALE = 0.65;

/** Pixel-art furniture props parked at each area's desk slots, so rooms read as real workspaces (docs/10 #2). */
function AreaFurniture({ area }: { area: AreaLayout }) {
  const texture = FURNITURE_TEXTURES[AREA_FURNITURE[area.areaId]];
  return (
    <>
      {areaSlots(area.areaId).map((slot, i) => (
        <Sprite
          key={i}
          texture={texture}
          x={slot.x}
          y={slot.y + 6}
          anchor={{ x: 0.5, y: 1 }}
          scale={{ x: FURNITURE_SCALE, y: FURNITURE_SCALE }}
        />
      ))}
    </>
  );
}

function AreaRoom({ area }: { area: AreaLayout }) {
  const floorTint = lightenColor(area.color, 0.72);
  const wallTint = shadeColor(lightenColor(area.color, 0.55), 0.92);

  return (
    <>
      <TilingSprite
        texture={FLOOR_TEXTURE}
        x={area.x}
        y={area.y}
        width={area.width}
        height={area.height}
        tilePosition={{ x: 0, y: 0 }}
        tileScale={{ x: 2, y: 2 }}
        tint={floorTint}
      />
      <TilingSprite
        texture={WALL_TEXTURE}
        x={area.x}
        y={area.y - WALL_HEIGHT + 4}
        width={area.width}
        height={WALL_HEIGHT}
        tilePosition={{ x: 0, y: 0 }}
        tileScale={{ x: 2, y: WALL_HEIGHT / WALL_TEXTURE.height }}
        tint={wallTint}
      />
      <AreaFurniture area={area} />
      <Text text={`${area.icon} ${area.name}`} x={area.x + 8} y={area.y - WALL_HEIGHT + 6} style={AREA_LABEL_STYLE} />
    </>
  );
}

function OfficeFloor() {
  return (
    <>
      {PHASE2_AREA_LAYOUT.map((area) => (
        <AreaRoom key={area.areaId} area={area} />
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
    <Stage width={OFFICE_WIDTH} height={OFFICE_HEIGHT} options={{ backgroundColor: 0xdfe6ee, antialias: false }}>
      <Container>
        <OfficeFloor />
        <CharacterLayer />
      </Container>
    </Stage>
  );
}
