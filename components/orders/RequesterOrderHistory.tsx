"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, ShoppingBag } from "lucide-react";

import { useCart } from "@/components/cart/CartProvider";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { OrderCard } from "@/components/orders/OrderCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ORDER_SELECT } from "@/lib/order-select";
import { ORDER_STATUSES } from "@/lib/constants";
import { createBrowserClient } from "@/lib/supabase";
import type { OrderStatus, OrderWithDetails } from "@/types";

const PAGE_SIZE = 8;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...(
    [
      "awaiting_payment",
      "pending",
      "accepted",
      "picking_up",
      "on_the_way",
      "delivered",
      "cancelled",
    ] as OrderStatus[]
  ).map((s) => ({ value: s, label: ORDER_STATUSES[s].label })),
];

export function RequesterOrderHistory() {
  const router = useRouter();
  const toast = useToast();
  const { addItem } = useCart();

  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const offset = reset ? 0 : offsetRef.current;
      let query = supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (status !== "all") query = query.eq("status", status);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", `${to}T23:59:59`);

      const { data } = await query;
      const rows = (data as unknown as OrderWithDetails[]) ?? [];

      setHasMore(rows.length === PAGE_SIZE);
      offsetRef.current = offset + rows.length;
      setOrders((prev) => (reset ? rows : [...prev, ...rows]));
    },
    [status, from, to],
  );

  // Re-query when filters change.
  useEffect(() => {
    setLoading(true);
    void fetchPage(true).finally(() => setLoading(false));
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    await fetchPage(false);
    setLoadingMore(false);
  }

  function reorder(order: OrderWithDetails) {
    order.order_items.forEach((li) => addItem(li.item, li.quantity));
    const count = order.order_items.reduce((n, li) => n + li.quantity, 0);
    toast.success(`Added ${count} item${count === 1 ? "" : "s"} to your cart.`);
    router.push("/requester/checkout");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-stone-900">
        My orders
      </h1>
      <p className="mt-0.5 text-stone-500">Track and reorder past deliveries.</p>

      {/* Filters */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={STATUS_OPTIONS}
        />
        <Input
          label="From"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          label="To"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            emoji="🛍️"
            title="Your first delivery is a tap away"
            description="Nothing here yet — or try clearing your filters."
            action={
              <Link href="/requester">
                <Button leftIcon={<ShoppingBag className="h-4 w-4" />}>
                  Browse items
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {orders.map((order) => (
              <div
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/requester/orders/${order.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/requester/orders/${order.id}`);
                  }
                }}
                className="press cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <OrderCard
                  order={order}
                  perspective="requester"
                  actions={
                    <Button
                      className="w-full"
                      leftIcon={<RotateCcw className="h-4 w-4" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        reorder(order);
                      }}
                    >
                      Reorder
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              isLoading={loadingMore}
              onClick={loadMore}
            >
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
