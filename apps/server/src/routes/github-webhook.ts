import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "@agentia/db";
import { env } from "../config/env.js";
import type { ProjectRegistry } from "../persistence/project-registry.js";

/** Constant-time comparison of the `X-Hub-Signature-256` header against the HMAC we compute (docs/15_SECURITY_DESIGN.md). */
function verifySignature(secret: string, rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

interface GithubEventSummary {
  type: string;
  action: string | null;
  actor: string | null;
  url: string | null;
  payloadSummary: string;
}

/** docs/04_CLAUDE_CODE_INTEGRATION.md #6, docs/10_OFFICE_SYSTEM.md github_hub: the webhook event types we map. */
function summarize(githubEventName: string, payload: Record<string, any>): GithubEventSummary | null {
  const actor: string | null = payload["sender"]?.login ?? null;
  const repoUrl: string | null = payload["repository"]?.html_url ?? null;

  switch (githubEventName) {
    case "push": {
      const branch = typeof payload["ref"] === "string" ? payload["ref"].replace("refs/heads/", "") : "?";
      const commits = Array.isArray(payload["commits"]) ? payload["commits"] : [];
      const headMessage = (payload["head_commit"]?.message as string | undefined)?.split("\n")[0] ?? "";
      return {
        type: "push",
        action: null,
        actor,
        url: payload["compare"] ?? repoUrl,
        payloadSummary: `${branch} に ${commits.length} 件のcommitをpush${headMessage ? `: ${headMessage}` : ""}`,
      };
    }
    case "pull_request": {
      const pr = payload["pull_request"] ?? {};
      const action = (payload["action"] as string | undefined) ?? null;
      return {
        type: "pull_request",
        action,
        actor,
        url: pr.html_url ?? repoUrl,
        payloadSummary: `PR #${pr.number ?? "?"} ${action ?? ""}: ${pr.title ?? ""}`.trim(),
      };
    }
    case "issues": {
      const issue = payload["issue"] ?? {};
      const action = (payload["action"] as string | undefined) ?? null;
      return {
        type: "issues",
        action,
        actor,
        url: issue.html_url ?? repoUrl,
        payloadSummary: `Issue #${issue.number ?? "?"} ${action ?? ""}: ${issue.title ?? ""}`.trim(),
      };
    }
    case "pull_request_review": {
      const pr = payload["pull_request"] ?? {};
      const review = payload["review"] ?? {};
      const action = (payload["action"] as string | undefined) ?? null;
      return {
        type: "pull_request_review",
        action,
        actor,
        url: review.html_url ?? pr.html_url ?? repoUrl,
        payloadSummary: `PR #${pr.number ?? "?"} へレビュー(${review.state ?? action ?? ""}): ${pr.title ?? ""}`.trim(),
      };
    }
    default:
      return null;
  }
}

/**
 * docs/18_ROADMAP.md #3, docs/11_DATABASE_DESIGN.md #3: GitHub Webhook receiver.
 * Separate channel from Claude Code Hooks (docs/04 #6) - normalized events are persisted as
 * GithubEvent rows keyed to whichever project has this repo linked via /api/projects/:id/github-repo.
 * Body parsing is scoped to this plugin instance only (buffer parseAs) so signature verification
 * can run against the exact raw bytes GitHub signed, without affecting any other route's JSON parsing.
 */
export function registerGithubWebhookRoute(fastify: FastifyInstance, projectRegistry: ProjectRegistry): void {
  fastify.register(async (instance) => {
    instance.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
      try {
        done(null, { raw: body as Buffer, json: JSON.parse((body as Buffer).toString("utf8")) as Record<string, any> });
      } catch (error) {
        done(error as Error, undefined);
      }
    });

    instance.post<{ Body: { raw: Buffer; json: Record<string, any> } }>("/webhooks/github", async (request, reply) => {
      if (!env.githubWebhookSecret) {
        return reply
          .code(503)
          .send({ error: { code: "GITHUB_WEBHOOK_NOT_CONFIGURED", message: "AGENTIA_GITHUB_WEBHOOK_SECRET is not set", details: null } });
      }

      const signatureHeader = request.headers["x-hub-signature-256"];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      if (!verifySignature(env.githubWebhookSecret, request.body.raw, signature)) {
        return reply.code(401).send({ error: { code: "INVALID_SIGNATURE", message: "signature verification failed", details: null } });
      }

      const eventNameHeader = request.headers["x-github-event"];
      const githubEventName = Array.isArray(eventNameHeader) ? eventNameHeader[0] : eventNameHeader;
      const payload = request.body.json;
      const repoFullName: string | undefined = payload["repository"]?.full_name;

      if (!githubEventName || !repoFullName) {
        return reply.code(400).send({ error: { code: "MALFORMED_PAYLOAD", message: "missing event type or repository", details: null } });
      }

      const summary = summarize(githubEventName, payload);
      if (!summary) {
        // Unmapped event type (e.g. "ping") - acknowledge so GitHub doesn't retry, but store nothing.
        return reply.code(202).send({ status: "ignored" });
      }

      const project = projectRegistry.findByGithubRepo(repoFullName);
      if (!project) {
        return reply.code(202).send({ status: "ignored", reason: "repository is not linked to any project" });
      }

      await prisma.githubEvent.create({
        data: {
          projectId: project.projectId,
          repo: repoFullName,
          type: summary.type,
          action: summary.action,
          actor: summary.actor,
          url: summary.url,
          payloadSummary: summary.payloadSummary,
        },
      });

      return reply.code(202).send({ status: "recorded" });
    });
  });
}
