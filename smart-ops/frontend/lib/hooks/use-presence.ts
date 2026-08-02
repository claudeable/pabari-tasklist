"use client";

import { useEffect } from "react";
import { api } from "@/lib/api-client";

const PING_INTERVAL_MS = 60 * 1000;

/**
 * Marks the current user active: pings immediately on mount, then every
 * 60s and whenever the window regains focus. Intended to be mounted once
 * per authenticated session (see app/(app)/layout.tsx).
 */
export function usePresencePing() {
  useEffect(() => {
    function ping() {
      api.pingPresence().catch(() => {
        // Best-effort — presence is not critical path.
      });
    }

    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    window.addEventListener("focus", ping);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", ping);
    };
  }, []);
}
