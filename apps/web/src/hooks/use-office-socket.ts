"use client";

import { useEffect, useRef } from "react";
import { ServerMessageSchema } from "@agentia/shared-types";
import { HEARTBEAT_TIMEOUT_MS, RECONNECT_BACKOFF_MS, SERVER_WS_URL } from "@/lib/constants";
import { useOfficeStore } from "@/stores/office-store";

/**
 * docs/06_REALTIME_COMMUNICATION.md #2/#3: owns the single WebSocket connection for the
 * office screen - HELLO/SNAPSHOT/EVENT/REPLAY/HEARTBEAT handling, exponential-backoff
 * reconnect, and the heartbeat watchdog. Screen components only read the Zustand store.
 */
export function useOfficeSocket(projectId: string): void {
  const attemptRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    function resetWatchdog() {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      watchdogRef.current = setTimeout(() => {
        socketRef.current?.close();
      }, HEARTBEAT_TIMEOUT_MS);
    }

    function connect() {
      if (cancelled) return;
      const lastSeq = useOfficeStore.getState().lastSeq;
      const url = `${SERVER_WS_URL}?projectId=${encodeURIComponent(projectId)}&lastSeq=${lastSeq}`;
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0;
        useOfficeStore.getState().setConnectionState("connected");
        resetWatchdog();
      };

      socket.onmessage = (raw) => {
        resetWatchdog();
        let data: unknown;
        try {
          data = JSON.parse(String(raw.data));
        } catch {
          return;
        }
        const parsed = ServerMessageSchema.safeParse(data);
        if (!parsed.success) return;
        const message = parsed.data;

        switch (message.type) {
          case "SNAPSHOT":
            useOfficeStore.getState().hydrateSnapshot(message.employees);
            break;
          case "EVENT":
            useOfficeStore.getState().applyIncomingEvent(message.event);
            break;
          case "REPLAY":
            for (const entry of message.events) useOfficeStore.getState().applyIncomingEvent(entry.event);
            break;
          case "HELLO":
          case "HEARTBEAT":
          case "ERROR":
            break;
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        useOfficeStore.getState().setConnectionState("reconnecting");
        const delay = RECONNECT_BACKOFF_MS[Math.min(attemptRef.current, RECONNECT_BACKOFF_MS.length - 1)] ?? 30_000;
        attemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
    };
  }, [projectId]);
}
