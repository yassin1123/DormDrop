"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker (production only). Renders nothing.
 * The SW serves /offline.html when a navigation fails so the app shows a
 * friendly "You're offline" page instead of a browser error.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal.
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
