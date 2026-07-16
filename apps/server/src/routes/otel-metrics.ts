import type { FastifyInstance } from "fastify";
import { prisma } from "@agentia/db";

/**
 * docs/04_CLAUDE_CODE_INTEGRATION.md #4 (トークン使用量・コスト, classification C),
 * docs/18_ROADMAP.md #3: minimal OTLP/HTTP JSON metrics receiver for the two metrics
 * Claude Code's OTel export exposes that Hooks cannot provide: `claude_code.token.usage`
 * and `claude_code.cost.usage`. Every other metric Claude Code emits is ignored.
 *
 * Point Claude Code at this endpoint with:
 *   CLAUDE_CODE_ENABLE_TELEMETRY=1
 *   OTEL_METRICS_EXPORTER=otlp
 *   OTEL_EXPORTER_OTLP_PROTOCOL=http/json
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:<AGENTIA_SERVER_PORT>   (appends /v1/metrics)
 *
 * Both metrics are Counters exported with `delta` temporality by default (Claude Code's
 * own default for OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE) - each data point is
 * an incremental amount since the last export, so we accumulate it into the Session row
 * rather than treating it as a running total to overwrite. Cumulative temporality (if a
 * user overrides the default) is not handled and would double-count; out of scope for now.
 */

interface OtlpAttributeValue {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
}
interface OtlpAttribute {
  key: string;
  value: OtlpAttributeValue;
}
interface OtlpNumberDataPoint {
  attributes?: OtlpAttribute[];
  asDouble?: number;
  asInt?: string | number;
}
interface OtlpMetric {
  name: string;
  sum?: { dataPoints: OtlpNumberDataPoint[] };
  gauge?: { dataPoints: OtlpNumberDataPoint[] };
}
interface OtlpResourceMetrics {
  resource?: { attributes?: OtlpAttribute[] };
  scopeMetrics?: Array<{ metrics?: OtlpMetric[] }>;
}
export interface OtlpMetricsRequest {
  resourceMetrics?: OtlpResourceMetrics[];
}

function attrValue(attr: OtlpAttribute): string | undefined {
  const v = attr.value;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.doubleValue !== undefined) return String(v.doubleValue);
  if (v.intValue !== undefined) return String(v.intValue);
  if (v.boolValue !== undefined) return String(v.boolValue);
  return undefined;
}

function findAttr(attrs: OtlpAttribute[] | undefined, key: string): string | undefined {
  const found = attrs?.find((a) => a.key === key);
  return found ? attrValue(found) : undefined;
}

function dataPointValue(dp: OtlpNumberDataPoint): number {
  if (dp.asDouble !== undefined) return dp.asDouble;
  if (dp.asInt !== undefined) return Number(dp.asInt);
  return 0;
}

export interface SessionDelta {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function collectDeltas(body: OtlpMetricsRequest): Map<string, SessionDelta> {
  const deltas = new Map<string, SessionDelta>();

  function addTo(sessionId: string, field: keyof SessionDelta, amount: number): void {
    const delta = deltas.get(sessionId) ?? { inputTokens: 0, outputTokens: 0, costUsd: 0 };
    delta[field] += amount;
    deltas.set(sessionId, delta);
  }

  for (const resourceMetrics of body.resourceMetrics ?? []) {
    const resourceSessionId = findAttr(resourceMetrics.resource?.attributes, "session.id");
    for (const scopeMetrics of resourceMetrics.scopeMetrics ?? []) {
      for (const metric of scopeMetrics.metrics ?? []) {
        const dataPoints = metric.sum?.dataPoints ?? metric.gauge?.dataPoints ?? [];
        for (const dp of dataPoints) {
          const sessionId = findAttr(dp.attributes, "session.id") ?? resourceSessionId;
          if (!sessionId) continue; // can't correlate to a Claude Code session, drop it

          if (metric.name === "claude_code.token.usage") {
            const type = findAttr(dp.attributes, "type");
            if (type === "input") addTo(sessionId, "inputTokens", dataPointValue(dp));
            else if (type === "output") addTo(sessionId, "outputTokens", dataPointValue(dp));
            // cacheRead/cacheCreation token types aren't tracked separately (Session has no column for them).
          } else if (metric.name === "claude_code.cost.usage") {
            addTo(sessionId, "costUsd", dataPointValue(dp));
          }
        }
      }
    }
  }
  return deltas;
}

export function registerOtelMetricsRoute(fastify: FastifyInstance): void {
  fastify.post<{ Body: OtlpMetricsRequest }>("/v1/metrics", async (request, reply) => {
    const deltas = collectDeltas(request.body ?? {});
    await Promise.all(
      Array.from(deltas.entries()).map(([sessionId, delta]) =>
        prisma.session.updateMany({
          where: { id: sessionId },
          data: {
            inputTokens: { increment: Math.round(delta.inputTokens) },
            outputTokens: { increment: Math.round(delta.outputTokens) },
            costUsd: { increment: delta.costUsd },
          },
        })
      )
    );
    return reply.code(200).send({});
  });
}
