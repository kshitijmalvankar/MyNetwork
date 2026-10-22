"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production builds. In development, build files keep the
 * same names between edits, so a cache would serve stale code: any worker left
 * over from a production run on this origin is removed instead.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => {
      console.warn("[sw] registration failed", err);
    });
  }, []);
  return null;
}
