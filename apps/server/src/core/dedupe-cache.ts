/** docs/05_EVENT_DESIGN.md #5: LRU cache of clientEventId to drop duplicate hook POSTs. */
export class DedupeCache {
  private readonly order: string[] = [];
  private readonly seen = new Set<string>();

  constructor(private readonly maxEntries: number) {}

  /** Returns true if this id was already seen (i.e. the event should be dropped). */
  checkAndRecord(clientEventId: string): boolean {
    if (this.seen.has(clientEventId)) {
      return true;
    }
    this.seen.add(clientEventId);
    this.order.push(clientEventId);
    if (this.order.length > this.maxEntries) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return false;
  }
}
