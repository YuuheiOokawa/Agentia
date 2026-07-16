import { BaseTexture, SCALE_MODES, Texture } from "pixi.js";
import type { CharacterState } from "@agentia/shared-types";
import type { FurnitureProp } from "./map/map";

// Pixel art must never be smoothed - keep every sprite crisp when scaled (docs request: real pixel-art assets).
BaseTexture.defaultOptions.scaleMode = SCALE_MODES.NEAREST;

const SPRITE_BASE = "/sprites";

export type CharacterPose = "idle" | "working" | "error" | "completed";
/** Which way the character is drawn facing - "front" (toward the viewer) or "back" (walking away/up),
 * a pure rendering flourish driven by movement direction (like the wander stroll), not store state. */
export type Facing = "front" | "back";

function pairTexture(pose: CharacterPose, facing: Facing) {
  return {
    body: Texture.from(`${SPRITE_BASE}/char_${pose}_${facing}_body.png`),
    details: Texture.from(`${SPRITE_BASE}/char_${pose}_${facing}_details.png`),
  };
}

export const CHARACTER_TEXTURES: Record<CharacterPose, Record<Facing, { body: Texture; details: Texture }>> = {
  idle: { front: pairTexture("idle", "front"), back: pairTexture("idle", "back") },
  working: { front: pairTexture("working", "front"), back: pairTexture("working", "back") },
  error: { front: pairTexture("error", "front"), back: pairTexture("error", "back") },
  completed: { front: pairTexture("completed", "front"), back: pairTexture("completed", "back") },
};

/** docs/09_CHARACTER_SYSTEM.md #3 states collapse onto a small set of sprite poses. */
const STATE_TO_POSE: Record<CharacterState, CharacterPose> = {
  idle: "idle",
  moving: "working",
  researching: "working",
  reading: "working",
  planning: "working",
  coding: "working",
  terminal: "working",
  testing: "working",
  deploying: "working",
  waiting: "idle",
  error: "error",
  completed: "completed",
};

export function poseForState(state: CharacterState): CharacterPose {
  return STATE_TO_POSE[state];
}

export const FLOOR_TEXTURE = Texture.from(`${SPRITE_BASE}/tile_floor.png`);
export const WALL_TEXTURE = Texture.from(`${SPRITE_BASE}/tile_wall.png`);
export const FLOOR_EDGE_TEXTURE = Texture.from(`${SPRITE_BASE}/tile_floor_edge.png`);
export const PARTITION_TEXTURE = Texture.from(`${SPRITE_BASE}/tile_partition.png`);

export const FURNITURE_TEXTURES: Record<FurnitureProp, Texture> = {
  desk: Texture.from(`${SPRITE_BASE}/prop_desk.png`),
  bookshelf: Texture.from(`${SPRITE_BASE}/prop_bookshelf.png`),
  plant: Texture.from(`${SPRITE_BASE}/prop_plant.png`),
  server: Texture.from(`${SPRITE_BASE}/prop_server.png`),
  reception: Texture.from(`${SPRITE_BASE}/prop_reception.png`),
  whiteboard: Texture.from(`${SPRITE_BASE}/prop_whiteboard.png`),
  cabinet: Texture.from(`${SPRITE_BASE}/prop_cabinet.png`),
  conference_table: Texture.from(`${SPRITE_BASE}/prop_conference_table.png`),
  monitor_wall: Texture.from(`${SPRITE_BASE}/prop_monitor_wall.png`),
  couch: Texture.from(`${SPRITE_BASE}/prop_couch.png`),
  vending_machine: Texture.from(`${SPRITE_BASE}/prop_vending_machine.png`),
};

/** Wall-mounted window prop for exterior-facing (topmost row) walls, untinted like furniture. */
export const WINDOW_TEXTURE = Texture.from(`${SPRITE_BASE}/prop_window.png`);
