"use client";

import { useEffect, useState } from "react";

import { createBrowserClient } from "@/lib/supabase";

export type LocationPermission =
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

interface UseLocationBroadcast {
  permission: LocationPermission;
  /** The runner's own latest position (updates live, for their map dot). */
  position: { lat: number; lng: number } | null;
}

const SEND_INTERVAL_MS = 10_000;

/**
 * While `active`, watch the device location and broadcast it to Supabase
 * (`runner_locations`, one row per runner) at most every 10 seconds. Stops
 * watching and deletes the row when `active` becomes false or on unmount.
 */
export function useLocationBroadcast(active: boolean): UseLocationBroadcast {
  const [permission, setPermission] = useState<LocationPermission>("prompt");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      return;
    }

    const supabase = createBrowserClient();
    let cancelled = false;
    let watchId: number | null = null;
    let runnerId: string | null = null;
    let lastSent = 0;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      runnerId = user.id;

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setPermission("granted");
          const { latitude, longitude, heading } = pos.coords;
          setPosition({ lat: latitude, lng: longitude });

          // Throttle the writes to ~every 10s (the first fix sends instantly).
          const now = Date.now();
          if (now - lastSent < SEND_INTERVAL_MS) return;
          lastSent = now;

          void supabase.from("runner_locations").upsert(
            {
              runner_id: runnerId,
              lat: latitude,
              lng: longitude,
              heading:
                heading != null && !Number.isNaN(heading) ? heading : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "runner_id" },
          );
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setPermission("denied");
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
      );
    });

    return () => {
      cancelled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      // Best-effort: clear the row so the requester stops seeing a stale pin.
      if (runnerId) {
        void supabase.from("runner_locations").delete().eq("runner_id", runnerId);
      }
    };
  }, [active]);

  return { permission, position };
}
