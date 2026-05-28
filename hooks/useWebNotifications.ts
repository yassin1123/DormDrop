"use client";

import { useCallback, useEffect, useState } from "react";

export type NotificationPerm = "default" | "granted" | "denied" | "unsupported";

interface UseWebNotifications {
  permission: NotificationPerm;
  supported: boolean;
  requestPermission: () => Promise<void>;
  /** Show a browser notification (no-op unless permission is granted). */
  notify: (title: string, body?: string) => void;
}

/**
 * Thin wrapper over the Web Notifications API: tracks permission, requests it
 * (must be called from a user gesture), and shows notifications. All calls are
 * safe no-ops where the API is unavailable or permission isn't granted.
 */
export function useWebNotifications(): UseWebNotifications {
  const [permission, setPermission] = useState<NotificationPerm>("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotificationPerm);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPerm);
    } catch {
      // ignore — user dismissed / browser blocked
    }
  }, []);

  const notify = useCallback((title: string, body?: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification(title, {
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: "dormdrop",
      });
    } catch {
      // Some browsers throw if called outside a SW on certain platforms.
    }
  }, []);

  return {
    permission,
    supported: permission !== "unsupported",
    requestPermission,
    notify,
  };
}
