"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  PackageCheck,
  Star,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { ShareButton } from "@/components/share/ShareButton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createBrowserClient } from "@/lib/supabase";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const PAGE_SIZE = 10;

interface HistoryRow {
  id: string;
  delivered_at: string | null;
  created_at: string;
  delivery_fee: number;
  delivery_zone: string;
  order_items: { quantity: number }[];
}

export function RunnerHistory() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [ratings, setRatings] = useState<Map<string, number>>(new Map());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  // Ratings received, keyed by order.
  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    supabase
      .from("reviews")
      .select("order_id, rating")
      .eq("reviewee_id", user.id)
      .then(({ data }) => {
        const map = new Map<string, number>();
        (data ?? []).forEach((r) =>
          map.set(r.order_id as string, r.rating as number),
        );
        setRatings(map);
      });
  }, [user]);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!user) return;
      const supabase = createBrowserClient();
      const offset = reset ? 0 : offsetRef.current;

      let query = supabase
        .from("orders")
        .select(
          "id, delivered_at, created_at, delivery_fee, delivery_zone, order_items ( quantity )",
        )
        .eq("runner_id", user.id)
        .eq("status", "delivered")
        .order("delivered_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (from) query = query.gte("delivered_at", from);
      if (to) query = query.lte("delivered_at", `${to}T23:59:59`);

      const { data } = await query;
      const page = (data as HistoryRow[] | null) ?? [];

      setHasMore(page.length === PAGE_SIZE);
      offsetRef.current = offset + page.length;
      setRows((prev) => (reset ? page : [...prev, ...page]));
    },
    [user, from, to],
  );

  useEffect(() => {
    setLoading(true);
    void fetchPage(true).finally(() => setLoading(false));
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    await fetchPage(false);
    setLoadingMore(false);
  }

  return (
    <div className="mx-auto max-w-xl pb-10">
      <Link
        href="/runner"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <h1 className="font-display text-2xl font-bold text-stone-900">
        Delivery history
      </h1>

      {/* Total earnings headline */}
      <div className="mt-4 rounded-3xl bg-brand-900 p-6 text-white shadow-soft-lg">
        <p className="flex items-center gap-1.5 text-sm text-brand-200">
          <Wallet className="h-4 w-4" /> Total earned, all time
        </p>
        <p className="mt-1 font-display text-4xl font-extrabold text-accent-400">
          {formatCurrency(profile?.total_earnings ?? 0)}
        </p>
        <p className="mt-1 text-sm text-brand-200">
          across {profile?.total_deliveries ?? 0}{" "}
          {profile?.total_deliveries === 1 ? "delivery" : "deliveries"}
        </p>
        {(profile?.total_earnings ?? 0) > 0 && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <ShareButton
              variant="secondary"
              size="sm"
              className="w-full"
              label="Share your earnings"
              caption={`I've earned ${formatCurrency(profile?.total_earnings ?? 0)} delivering on DormDrop! 🚀 Runner life at Southampton.`}
              card={{
                eyebrow: "DormDrop Runner",
                headline: "Earned all-time",
                stat: formatCurrency(profile?.total_earnings ?? 0),
                emoji: "🚀",
              }}
            />
          </div>
        )}
      </div>

      {/* Date filter */}
      <div className="mt-5 grid grid-cols-2 gap-3">
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

      {/* Rows */}
      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <PackageCheck className="h-8 w-8 text-stone-300" />
              <p className="font-medium text-stone-700">No deliveries found</p>
              <p className="text-sm text-stone-500">
                Completed deliveries will show up here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
            {rows.map((row) => {
              const itemCount = row.order_items.reduce(
                (n, li) => n + li.quantity,
                0,
              );
              const rating = ratings.get(row.id);
              return (
                <li key={row.id} className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <PackageCheck className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900">
                      #{row.id.slice(0, 8)} · {row.delivery_zone}
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatDateTime(row.delivered_at ?? row.created_at)} ·{" "}
                      {itemCount} {itemCount === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-emerald-600">
                      +{formatCurrency(row.delivery_fee)}
                    </p>
                    {rating ? (
                      <p className="flex items-center justify-end gap-0.5 text-xs text-stone-500">
                        <Star className="h-3 w-3 fill-accent-400 text-accent-400" />
                        {rating.toFixed(1)}
                      </p>
                    ) : (
                      <p className="text-xs text-stone-300">Not rated</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
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
