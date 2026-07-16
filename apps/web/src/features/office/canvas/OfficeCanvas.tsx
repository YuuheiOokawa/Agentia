"use client";

import { Stage, Container, Sprite, TilingSprite, Text } from "@pixi/react";
import { TextStyle } from "pixi.js";
import { useOfficeStore } from "@/stores/office-store";
import { lightenColor, shadeColor } from "@/lib/color";
import { AREA_ACCESSORY, AREA_FURNITURE, areaSlots, OFFICE_HEIGHT, OFFICE_WIDTH, PHASE2_AREA_LAYOUT, roomDividers, type AreaLayout } from "../map/map";
import { CharacterSprite } from "../characters/CharacterSprite";
import { FLOOR_EDGE_TEXTURE, FLOOR_TEXTURE, FURNITURE_TEXTURES, PARTITION_TEXTURE, WALL_TEXTURE, WINDOW_TEXTURE } from "../pixel-assets";

const AREA_LABEL_STYLE = new TextStyle({
  fontSize: 12,
  fontWeight: "700",
  fill: 0xffffff,
  stroke: 0x000000,
  strokeThickness: 3,
});

const WALL_HEIGHT = 22;
const FURNITURE_SCALE = 0.65;
/** Fixed literal, not computed from WINDOW_TEXTURE.width/height: PIXI textures report a placeholder
 * size before their image finishes loading, and a plain Sprite's rendered size is nativeSize*scale
 * with nothing to bound it - computing scale from a not-yet-loaded texture's dimensions makes the
 * sprite balloon to fill the stage once the real image loads in. (TilingSprite's tileScale doesn't
 * have this problem since its own explicit width/height always bounds the render regardless.) */
const WINDOW_SCALE = 0.3;
const WINDOW_SPACING_PX = 34;

/** Pixel-art furniture props parked at each area's desk slots, so rooms read as real workspaces (docs/10 #2).
 * A room can list several props (docs/07 "会社みたいに") - they cycle across slots by index instead of
 * repeating one prop everywhere. */
function AreaFurniture({ area }: { area: AreaLayout }) {
  const furniture = AREA_FURNITURE[area.areaId];
  const props = Array.isArray(furniture) ? furniture : [furniture];
  return (
    <>
      {areaSlots(area.areaId).map((slot, i) => (
        <Sprite
          key={i}
          texture={FURNITURE_TEXTURES[props[i % props.length]!]}
          x={slot.x}
          y={slot.y + 6}
          anchor={{ x: 0.5, y: 1 }}
          scale={{ x: FURNITURE_SCALE, y: FURNITURE_SCALE }}
        />
      ))}
    </>
  );
}

/** One extra prop in the room's bottom-right corner (docs/07 "会社みたいに") - never at a desk slot, so it
 * never competes with character placement (areaSlotFor uses the same slot list for both). */
function AreaAccessory({ area }: { area: AreaLayout }) {
  const prop = AREA_ACCESSORY[area.areaId];
  if (!prop) return null;
  return (
    <Sprite
      texture={FURNITURE_TEXTURES[prop]}
      x={area.x + area.width - 20}
      y={area.y + area.height - 12}
      anchor={{ x: 1, y: 1 }}
      scale={{ x: FURNITURE_SCALE * 0.85, y: FURNITURE_SCALE * 0.85 }}
    />
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
      <AreaAccessory area={area} />
      <Text text={`${area.icon} ${area.name}`} x={area.x + 8} y={area.y - WALL_HEIGHT + 6} style={AREA_LABEL_STYLE} />
    </>
  );
}

/** Fills the gaps between rooms so borders read as real corridors/walls instead of bare stage background
 * showing through (docs/07 "部屋同士の境界をはっきりさせる") - rendered under the rooms themselves. */
function RoomDividers() {
  const { partitions, floorEdges } = roomDividers();
  return (
    <>
      {floorEdges.map((edge, i) => (
        <TilingSprite
          key={`edge-${i}`}
          texture={FLOOR_EDGE_TEXTURE}
          x={edge.x}
          y={edge.y}
          width={edge.width}
          height={edge.height}
          tilePosition={{ x: 0, y: 0 }}
          tileScale={{ x: 1, y: edge.height / FLOOR_EDGE_TEXTURE.height }}
        />
      ))}
      {partitions.map((p, i) => (
        <TilingSprite
          key={`partition-${i}`}
          texture={PARTITION_TEXTURE}
          x={p.x}
          y={p.y}
          width={p.width}
          height={p.height}
          tilePosition={{ x: 0, y: 0 }}
          tileScale={{ x: p.width / PARTITION_TEXTURE.width, y: p.width / PARTITION_TEXTURE.width }}
        />
      ))}
    </>
  );
}

/** Windows on the topmost row's walls only (docs/07 "会社みたいに") - those are the office's exterior-facing
 * walls, everything else backs onto another room. A fixed-color overlay on top of the tinted wall band,
 * same as furniture never being tinted by its room's accent color. Anchored to each room's right edge,
 * growing leftward, so they never collide with the left-aligned room-name label in the same wall band. */
function ExteriorWindows() {
  const exteriorAreas = PHASE2_AREA_LAYOUT.filter((area) => area.row === 0);
  return (
    <>
      {exteriorAreas.flatMap((area) => {
        const count = area.width > 200 ? 2 : 1;
        return Array.from({ length: count }, (_, i) => (
          <Sprite
            key={`${area.areaId}-window-${i}`}
            texture={WINDOW_TEXTURE}
            x={area.x + area.width - 12 - i * WINDOW_SPACING_PX}
            y={area.y - WALL_HEIGHT + 3}
            anchor={{ x: 1, y: 0 }}
            scale={{ x: WINDOW_SCALE, y: WINDOW_SCALE }}
          />
        ));
      })}
    </>
  );
}

function OfficeFloor() {
  return (
    <>
      <RoomDividers />
      {PHASE2_AREA_LAYOUT.map((area) => (
        <AreaRoom key={area.areaId} area={area} />
      ))}
      <ExteriorWindows />
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
