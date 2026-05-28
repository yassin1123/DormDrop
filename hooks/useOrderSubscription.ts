"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ORDER_SELECT } from "@/lib/order-select";
import { createBrowserClient } from "@/lib/supabase";
import type { OrderWithDetails } from "@/types";

interface UseOrderSubscription {
  /** The latest order state, or null until the first fetch resolves. */
  order: OrderWithDetails | null;
  loading: boolean;
  /** Manually re-fetch (e.g. after a mutation). */
  refresh: () => Promise<void>;
}

/**
 * Subscribe to a single order and keep its full state in sync.
 *
 * - Refetches the hydrated row (items + profiles) on every UPDATE.
 * - Refetches whenever the channel (re)subscribes — this is the reconnection
 *   path: if the websocket drops and Supabase re-establishes it, we pull the
 *   current state so nothing missed while offline is lost.
 * - Also refetches on window focus as a belt-and-braces fallback.
 * - Cleans up the channel + listeners on unmount.
 *
 * Pass `initialOrder` (from a server fetch) to render immediately without a
 * loading flash.
 */
export function useOrderSubscription(
  orderId: string,
  initialOrder?: OrderWithDetails | null,
): UseOrderSubscription {
  const [order, setOrder] = useState<OrderWithDetails | null>(
    initialOrder ?? null,
  );
  const [loading, setLoading] = useState(!initialOrder);
  const clientRef = useRef<SupabaseClient | null>(null);

  const refresh = useCallback(async () => {
    const supabase = clientRef.current ?? createBrowserClient();
    clientRef.current = supabase;
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .single();
    if (data) setOrder(data as unknown as OrderWithDetails);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserClient();
    clientRef.current = supabase;

    if (!initialOrder) void refresh();

    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        () => {
          if (active) void refresh();
        },
      )
      .subscribe((status) => {
        // Fires on first subscribe and again after a reconnect.
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
    // `initialOrder` intentionally excluded: we only want to (re)subscribe when
    // the order id or the refresh fn changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, refresh]);

  return { order, loading, refresh };
}
