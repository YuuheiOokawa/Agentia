import { afterEach, describe, expect, it } from "vitest";
import { resolveIngestUrl } from "./forward.js";

describe("resolveIngestUrl", () => {
  afterEach(() => {
    delete process.env["AGENTIA_INGEST_URL"];
    delete process.env["AGENTIA_SERVER_PORT"];
  });

  it("defaults to localhost:4317", () => {
    expect(resolveIngestUrl()).toBe("http://127.0.0.1:4317/internal/events");
  });

  it("honors AGENTIA_SERVER_PORT", () => {
    process.env["AGENTIA_SERVER_PORT"] = "9999";
    expect(resolveIngestUrl()).toBe("http://127.0.0.1:9999/internal/events");
  });

  it("honors an explicit AGENTIA_INGEST_URL override", () => {
    process.env["AGENTIA_INGEST_URL"] = "http://example.internal/hook";
    expect(resolveIngestUrl()).toBe("http://example.internal/hook");
  });
});
