"use client";

import { useEffect, useState } from "react";

import { createBrowserClient } from "@/lib/supabase";
import type { RunnerLocation } from "@/types";

export interface LiveLocation {
  lat: number;
  lng: number;
  heading: number | null;
  updatedAt: string;
}

function toLive(row: RunnerLocation): LiveLocation {
  return {
    lat: Number(row.lat),
    lng: Number(row.lng),
    heading: row.heading == null ? null : Number(row.heading),
    updatedAt: row.updated_at,
  };
}

/**
 * Subscribe to a single runner's live location. Returns the latest
 * {lat, lng, heading} or null (no runner, or no location broadcast yet).
 */
export function useRunnerLocation(
  runnerId: string | null | undefined,
): LiveLocation | null {
  const [location, setLocation] = useState<LiveLocation | null>(null);

  useEffect(() => {
    if (!runnerId) {
      setLocation(null);
      return;
    }
    let active = true;
    const supabase = createBrowserClient();

    void supabase
      .from("runner_locations")
      .select("*")
      .eq("runner_id", runnerId)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setLocation(toLive(data as RunnerLocation));
      });

    const channel = supabase
      .channel(`runner_loc:${runnerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "runner_locations",
          filter: `runner_id=eq.${runnerId}`,
        },
        (payload) => {
          if (!active) return;
          if (payload.eventType === "DELETE") {
            setLocation(null);
          } else if (payload.new) {
            setLocation(toLive(payload.new as RunnerLocation));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [runnerId]);

  return location;
}
