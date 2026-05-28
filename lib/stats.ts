import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase-server";

export interface LiveStats {
  /** Lifetime delivered orders. */
  delivered: number;
  /** Runners (or "both" accounts) currently online. */
  runnersOnline: number;
}

/**
 * Live platform stats for the landing page. Cached for 60s via `unstable_cache`
 * so a busy landing page doesn't hammer the DB — and so it works even on the
 * (dynamic) landing route. Uses the service-role client for cheap COUNT(*)
 * head queries; falls back to zeros if anything goes wrong (e.g. env missing).
 */
export const getLiveStats = unstable_cache(
  async (): Promise<LiveStats> => {
    try {
      const admin = createAdminClient();
      const [delivered, runnersOnline] = await Promise.all([
        admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "delivered"),
        admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_online", true)
          .in("role", ["runner", "both"]),
      ]);
      return {
        delivered: delivered.count ?? 0,
        runnersOnline: runnersOnline.count ?? 0,
      };
    } catch {
      return { delivered: 0, runnersOnline: 0 };
    }
  },
  ["live-stats"],
  { revalidate: 60 },
);
