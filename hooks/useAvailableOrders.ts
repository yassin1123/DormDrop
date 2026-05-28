"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getZonesInRange } from "@/lib/constants";
import { ORDER_SELECT } from "@/lib/order-select";
import { createBrowserClient } from "@/lib/supabase";
import type { OrderWithDetails } from "@/types";

interface UseAvailableOrdersOptions {
  /** When false, no subscription/fetch runs and an empty list is returned. */
  enabled?: boolean;
}

interface UseAvailableOrders {
  /** Live list of claimable orders, filtered to the zone range. */
  orders: OrderWithDetails[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Live feed of available (pending, unclaimed) orders.
 *
 * - Subscribes to every change on the orders table; on INSERT a new pending
 *   order appears, on UPDATE a claimed order disappears (it's no longer
 *   pending/unassigned), all via a single re-fetch of the open pool.
 * - Refetches on (re)subscribe — the reconnection path — and on window focus.
 * - Filters to `deliveryZone` + its neighbouring zones. Pass `null` for all
 *   zones. Changing the zone only re-filters; it does not re-subscribe.
 */
export function useAvailableOrders(
  deliveryZone: string | null,
  options: UseAvailableOrdersOptions = {},
): UseAvailableOrders {
  const enabled = options.enabled ?? true;
  const [allOrders, setAllOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(enabled);
  const clientRef = useRef<SupabaseClient | null>(null);

  const refresh = useCallback(async () => {
    const supabase = clientRef.current ?? createBrowserClient();
    clientRef.current = supabase;
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("status", "pending")
      .is("runner_id", null)
      .order("created_at", { ascending: false });
    setAllOrders((data as unknown as OrderWithDetails[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAllOrders([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const supabase = createBrowserClient();
    clientRef.current = supabase;
    void refresh();

    const channel = supabase
      .channel("available-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (active) void refresh();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && active) void refresh();
      });

    const onFocus = () => {
      if (active) void refresh();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);

  const orders = useMemo(() => {
    if (!deliveryZone) return allOrders;
    const zones = getZonesInRange(deliveryZone);
    if (zones.length === 0) return allOrders;
    return allOrders.filter((o) => zones.includes(o.delivery_zone));
  }, [allOrders, deliveryZone]);

  return { orders, loading, refresh };
}
