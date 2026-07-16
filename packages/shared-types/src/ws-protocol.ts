import { z } from "zod";
import { EventSchema } from "./event.js";
import { EmployeeSchema } from "./character.js";

/** docs/06_REALTIME_COMMUNICATION.md #2.1 message types. */
export const ServerHelloSchema = z.object({
  type: z.literal("HELLO"),
  serverTime: z.string(),
  lastSeq: z.number().int().nonnegative(),
  protocolVersion: z.literal("1.0"),
});

export const ServerSnapshotSchema = z.object({
  type: z.literal("SNAPSHOT"),
  employees: z.array(EmployeeSchema),
});

export const ServerEventSchema = z.object({
  type: z.literal("EVENT"),
  seq: z.number().int().nonnegative(),
  event: EventSchema,
});

export const ServerHeartbeatSchema = z.object({
  type: z.literal("HEARTBEAT"),
  serverTime: z.string(),
});

export const ServerReplaySchema = z.object({
  type: z.literal("REPLAY"),
  events: z.array(ServerEventSchema),
});

export const ServerErrorSchema = z.object({
  type: z.literal("ERROR"),
  code: z.string(),
  message: z.string(),
});

export const ServerMessageSchema = z.discriminatedUnion("type", [
  ServerHelloSchema,
  ServerSnapshotSchema,
  ServerEventSchema,
  ServerHeartbeatSchema,
  ServerReplaySchema,
  ServerErrorSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export const ClientSubscribeSchema = z.object({
  type: z.literal("SUBSCRIBE"),
  projectId: z.string(),
});

export const ClientAckSchema = z.object({
  type: z.literal("ACK"),
  lastReceivedSeq: z.number().int().nonnegative(),
});

export const ClientMessageSchema = z.discriminatedUnion("type", [ClientSubscribeSchema, ClientAckSchema]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
