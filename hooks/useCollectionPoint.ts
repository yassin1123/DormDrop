"use client";

import { useEffect, useState } from "react";

import { createBrowserClient } from "@/lib/supabase";
import type { CollectionPoint } from "@/types";

/**
 * Fetch a single collection point by id (the hub an order is assigned to).
 * Returns null until loaded, if there's no id, or if the table isn't there
 * yet (migration 0010) — callers fall back gracefully.
 */
export function useCollectionPoint(
  id: string | null | undefined,
): CollectionPoint | null {
  const [point, setPoint] = useState<CollectionPoint | null>(null);

  useEffect(() => {
    if (!id) {
      setPoint(null);
      return;
    }
    let active = true;
    void createBrowserClient()
      .from("collection_points")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) {
          setPoint({
            ...(data as CollectionPoint),
            lat: Number((data as CollectionPoint).lat),
            lng: Number((data as CollectionPoint).lng),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  return point;
}
