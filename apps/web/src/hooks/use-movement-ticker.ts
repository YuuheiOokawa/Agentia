"use client";

import { useEffect } from "react";
import { useOfficeStore } from "@/stores/office-store";

const DRAIN_INTERVAL_MS = 900;

/** docs/10_OFFICE_SYSTEM.md #4.2: periodically advances each employee's queued movement steps. */
export function useMovementTicker(): void {
  useEffect(() => {
    const id = setInterval(() => useOfficeStore.getState().tickMovementQueues(), DRAIN_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
