import { describe, expect, it } from "vitest";
import { applyDesiredStep, drainQueue, priorityForState, type MovementQueueSlice } from "./movement-queue";

const idleSlice = { areaId: "dev_floor" as const, state: "idle" as const, destinationAreaId: null, movementQueue: [] };

describe("priorityForState", () => {
  it("ranks error highest and idle lowest", () => {
    expect(priorityForState("error")).toBeGreaterThan(priorityForState("waiting"));
    expect(priorityForState("waiting")).toBeGreaterThan(priorityForState("coding"));
    expect(priorityForState("coding")).toBeGreaterThan(priorityForState("idle"));
  });
});

describe("applyDesiredStep", () => {
  it("moves immediately when the character is idle", () => {
    const next = applyDesiredStep(idleSlice, { eventId: "e1", state: "coding", areaId: "dev_floor", priority: 50 });
    expect(next.areaId).toBe("dev_floor");
    expect(next.state).toBe("coding");
  });

  it("queues a same-or-lower priority step instead of interrupting", () => {
    const moving = { areaId: "library" as const, state: "reading" as const, destinationAreaId: "library" as const, movementQueue: [] };
    const next = applyDesiredStep(moving, { eventId: "e2", state: "coding", areaId: "dev_floor", priority: 50 });
    expect(next.areaId).toBe("library"); // unchanged, still in flight
    expect(next.movementQueue).toHaveLength(1);
    expect(next.movementQueue[0]?.destinationAreaId).toBe("dev_floor");
  });

  it("interrupts immediately for a higher-priority step (error)", () => {
    const moving = { areaId: "library" as const, state: "reading" as const, destinationAreaId: "library" as const, movementQueue: [] };
    const next = applyDesiredStep(moving, { eventId: "e3", state: "error", areaId: "terminal_room", priority: 100 });
    expect(next.areaId).toBe("terminal_room");
    expect(next.state).toBe("error");
    expect(next.movementQueue).toHaveLength(0);
  });

  it("drops the oldest queued step once the queue exceeds the max length", () => {
    let slice: MovementQueueSlice = {
      areaId: "library",
      state: "reading",
      destinationAreaId: "library",
      movementQueue: [],
    };
    for (let i = 0; i < 5; i += 1) {
      slice = applyDesiredStep(slice, { eventId: `e${i}`, state: "coding", areaId: "dev_floor", priority: 50 });
    }
    expect(slice.movementQueue.length).toBeLessThanOrEqual(3);
  });
});

describe("drainQueue", () => {
  it("pops the next queued step and clears destination when the queue is empty", () => {
    const withQueue = {
      areaId: "library" as const,
      state: "reading" as const,
      destinationAreaId: "library" as const,
      movementQueue: [{ destinationAreaId: "dev_floor" as const, eventId: "e1", priority: 50 }],
    };
    const next = drainQueue(withQueue, "coding");
    expect(next.areaId).toBe("dev_floor");
    expect(next.state).toBe("coding");
    expect(next.movementQueue).toHaveLength(0);

    const empty = drainQueue(next, "idle");
    expect(empty.destinationAreaId).toBeNull();
  });
});
