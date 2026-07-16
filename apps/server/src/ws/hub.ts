import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import {
  ClientMessageSchema,
  type Employee,
  type InternalEvent,
  type ServerMessage,
} from "@agentia/shared-types";
import type { SessionManager } from "../core/session-manager.js";

const HEARTBEAT_INTERVAL_MS = 15_000;

interface Client {
  socket: WebSocket;
  projectId: string;
}

/**
 * docs/06_REALTIME_COMMUNICATION.md: broadcasts SessionManager's "event" stream to every
 * WebSocket client subscribed to the matching projectId, with HELLO/SNAPSHOT/REPLAY on connect.
 */
export function registerWebSocketHub(fastify: FastifyInstance, sessionManager: SessionManager): void {
  const clientsByProject = new Map<string, Set<Client>>();

  function send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  }

  function subscribe(client: Client): void {
    const set = clientsByProject.get(client.projectId) ?? new Set();
    set.add(client);
    clientsByProject.set(client.projectId, set);
  }

  function unsubscribe(client: Client): void {
    clientsByProject.get(client.projectId)?.delete(client);
  }

  sessionManager.on("event", (projectId: string, _sessionId: string, event: InternalEvent) => {
    const set = clientsByProject.get(projectId);
    if (!set) return;
    for (const client of set) send(client.socket, { type: "EVENT", seq: event.seq, event });
  });

  const heartbeat = setInterval(() => {
    for (const set of clientsByProject.values()) {
      for (const client of set) send(client.socket, { type: "HEARTBEAT", serverTime: new Date().toISOString() });
    }
  }, HEARTBEAT_INTERVAL_MS);
  fastify.addHook("onClose", (_instance, done) => {
    clearInterval(heartbeat);
    done();
  });

  fastify.get("/ws", { websocket: true }, (socket, req) => {
    const url = new URL(req.url ?? "/ws", "http://localhost");
    const projectId = url.searchParams.get("projectId") ?? "proj_default";
    const lastSeq = Number(url.searchParams.get("lastSeq") ?? "0");

    const client: Client = { socket, projectId };
    subscribe(client);

    send(socket, { type: "HELLO", serverTime: new Date().toISOString(), lastSeq, protocolVersion: "1.0" });

    const activeSessionId = sessionManager.getActiveSessionId(projectId);
    if (activeSessionId) {
      if (lastSeq > 0) {
        const missed = sessionManager.getRingBuffer().since(activeSessionId, lastSeq);
        if (missed && missed.length > 0) {
          send(socket, {
            type: "REPLAY",
            events: missed.map((event) => ({ type: "EVENT" as const, seq: event.seq, event })),
          });
        } else if (missed === null) {
          // Gap too large to replay: fall back to a full snapshot of current employee state.
          sendSnapshot(socket, sessionManager.listEmployees(activeSessionId));
        }
      } else {
        sendSnapshot(socket, sessionManager.listEmployees(activeSessionId));
      }
    }

    socket.on("message", (raw: Buffer) => {
      const parsed = ClientMessageSchema.safeParse(JSON.parse(raw.toString("utf8")));
      if (!parsed.success) return;
      if (parsed.data.type === "SUBSCRIBE") {
        unsubscribe(client);
        client.projectId = parsed.data.projectId;
        subscribe(client);
        const sessionId = sessionManager.getActiveSessionId(client.projectId);
        if (sessionId) sendSnapshot(socket, sessionManager.listEmployees(sessionId));
      }
      // ACK messages are informational only in the MVP (docs/06 #2.1); no server-side action needed yet.
    });

    socket.on("close", () => unsubscribe(client));
  });

  function sendSnapshot(socket: WebSocket, employees: Employee[]): void {
    send(socket, { type: "SNAPSHOT", employees });
  }
}
