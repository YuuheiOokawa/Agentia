import { describe, expect, it } from "vitest";
import { DedupeCache } from "./dedupe-cache.js";

describe("DedupeCache", () => {
  it("flags the second occurrence of the same clientEventId as a duplicate", () => {
    const cache = new DedupeCache(10);
    expect(cache.checkAndRecord("a")).toBe(false);
    expect(cache.checkAndRecord("a")).toBe(true);
    expect(cache.checkAndRecord("b")).toBe(false);
  });

  it("evicts the oldest entry once maxEntries is exceeded", () => {
    const cache = new DedupeCache(2);
    cache.checkAndRecord("a");
    cache.checkAndRecord("b");
    cache.checkAndRecord("c"); // evicts "a"
    expect(cache.checkAndRecord("a")).toBe(false); // no longer remembered, treated as new
    expect(cache.checkAndRecord("c")).toBe(true); // still remembered
  });
});
