import type { InternalEvent } from "@agentia/shared-types";

/** docs/06_REALTIME_COMMUNICATION.md #3: per-session replay buffer used to recover from short disconnects. */
export class SessionRingBuffer {
  private readonly buffers = new Map<string, InternalEvent[]>();

  constructor(private readonly maxEvents: number) {}

  push(sessionId: string, event: InternalEvent): void {
    const buffer = this.buffers.get(sessionId) ?? [];
    buffer.push(event);
    if (buffer.length > this.maxEvents) buffer.shift();
    this.buffers.set(sessionId, buffer);
  }

  /** Events with seq strictly greater than `afterSeq`, or null if the buffer no longer covers that point. */
  since(sessionId: string, afterSeq: number): InternalEvent[] | null {
    const buffer = this.buffers.get(sessionId);
    if (!buffer || buffer.length === 0) return afterSeq === 0 ? [] : null;
    const oldest = buffer[0];
    if (oldest && afterSeq < oldest.seq - 1) return null; // gap too large, buffer already trimmed past it
    return buffer.filter((e) => e.seq > afterSeq);
  }

  snapshotEmployees(sessionId: string): InternalEvent[] {
    return this.buffers.get(sessionId) ?? [];
  }
}
