import { describe, expect, it } from "vitest";
import { collectDeltas, type OtlpMetricsRequest } from "./otel-metrics.js";

function stringAttr(key: string, stringValue: string) {
  return { key, value: { stringValue } };
}

describe("collectDeltas", () => {
  it("sums input/output tokens and cost per session, keyed by the session.id attribute", () => {
    const body: OtlpMetricsRequest = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                {
                  name: "claude_code.token.usage",
                  sum: {
                    dataPoints: [
                      { attributes: [stringAttr("session.id", "session_1"), stringAttr("type", "input")], asInt: "100" },
                      { attributes: [stringAttr("session.id", "session_1"), stringAttr("type", "output")], asInt: "50" },
                      { attributes: [stringAttr("session.id", "session_1"), stringAttr("type", "cacheRead")], asInt: "9999" },
                    ],
                  },
                },
                {
                  name: "claude_code.cost.usage",
                  sum: {
                    dataPoints: [{ attributes: [stringAttr("session.id", "session_1")], asDouble: 0.0123 }],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const deltas = collectDeltas(body);
    expect(deltas.get("session_1")).toEqual({ inputTokens: 100, outputTokens: 50, costUsd: 0.0123 });
  });

  it("keys by resource-level session.id when the data point has none of its own", () => {
    const body: OtlpMetricsRequest = {
      resourceMetrics: [
        {
          resource: { attributes: [stringAttr("session.id", "session_resource")] },
          scopeMetrics: [
            {
              metrics: [
                {
                  name: "claude_code.token.usage",
                  sum: { dataPoints: [{ attributes: [stringAttr("type", "input")], asInt: "10" }] },
                },
              ],
            },
          ],
        },
      ],
    };

    expect(collectDeltas(body).get("session_resource")).toEqual({ inputTokens: 10, outputTokens: 0, costUsd: 0 });
  });

  it("drops data points with no session.id anywhere", () => {
    const body: OtlpMetricsRequest = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                { name: "claude_code.token.usage", sum: { dataPoints: [{ attributes: [stringAttr("type", "input")], asInt: "10" }] } },
              ],
            },
          ],
        },
      ],
    };

    expect(collectDeltas(body).size).toBe(0);
  });

  it("ignores metrics other than token.usage/cost.usage", () => {
    const body: OtlpMetricsRequest = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                {
                  name: "claude_code.session.count",
                  sum: { dataPoints: [{ attributes: [stringAttr("session.id", "session_1")], asInt: "1" }] },
                },
              ],
            },
          ],
        },
      ],
    };

    expect(collectDeltas(body).size).toBe(0);
  });
});
