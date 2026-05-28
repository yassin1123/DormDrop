"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bike,
  Coins,
  History,
  Loader2,
  MapPin,
  Power,
  RefreshCw,
  Star,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { AcceptOrderSheet } from "@/components/runner/AcceptOrderSheet";
import { AvailableOrderCard } from "@/components/runner/AvailableOrderCard";
import { usePullToRefresh } from "@/components/runner/usePullToRefresh";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { ShareButton } from "@/components/share/ShareButton";
import { Card, CardContent } from "@/components/ui/Card";
import { useAvailableOrders } from "@/hooks/useAvailableOrders";
import { playNewOrder, vibrate } from "@/lib/sounds";
import { createBrowserClient } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";
import type { OrderWithDetails, Profile } from "@/types";

const ONLINE_KEY = "dormdrop:runner:online";

interface RunnerDashboardProps {
  profile: Profile;
  activeDeliveries: OrderWithDetails[];
  todaysEarnings: number;
  weekEarnings: number;
  pendingPayout: number;
  /** Per-day earnings for the last 7 days (oldest → today). */
  weekData: { label: string; amount: number }[];
  weekDeliveries: number;
}

export function RunnerDashboard({
  profile,
  activeDeliveries,
  todaysEarnings,
  weekEarnings,
  pendingPayout,
  weekData,
  weekDeliveries,
}: RunnerDashboardProps) {
  const router = useRouter();
  const toast = useToast();

  const [online, setOnline] = useState(false);
  const [earningsTab, setEarningsTab] = useState<"today" | "week">("today");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [selected, setSelected] = useState<OrderWithDetails | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let next = false;
    try {
      next = localStorage.getItem(ONLINE_KEY) === "true";
    } catch {
      // ignore
    }
    setOnline(next);
    // Sync DB presence with the restored preference on load.
    void createBrowserClient()
      .from("profiles")
      .update({ is_online: next })
      .eq("id", profile.id);
  }, [profile.id]);

  function toggleOnline() {
    setOnline((prev) => {
      const next = !prev;
      // Going online: confirm audio works + unlock it for the session (this is
      // a user gesture, so the browser lets the AudioContext start here).
      if (next) {
        playNewOrder();
        vibrate(40);
      }
      try {
        localStorage.setItem(ONLINE_KEY, String(next));
      } catch {
        // ignore
      }
      // Persist presence so requesters can tell if runners are around.
      void createBrowserClient()
        .from("profiles")
        .update({ is_online: next })
        .eq("id", profile.id);
      return next;
    });
  }

  const {
    orders: feed,
    loading: feedLoading,
    refresh: refetchFeed,
  } = useAvailableOrders(scope === "mine" ? profile.delivery_zone : null, {
    enabled: online,
  });

  const { pull, refreshing } = usePullToRefresh(refetchFeed, online);

  // Chime + buzz when a genuinely new order lands in the feed (not on first
  // load or scope changes — only when an unseen order id appears).
  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!online) {
      seenIds.current = null;
      return;
    }
    const ids = feed.map((o) => o.id);
    if (seenIds.current === null) {
      seenIds.current = new Set(ids); // first populate — stay quiet
      return;
    }
    const hasNew = ids.some((id) => !seenIds.current!.has(id));
    seenIds.current = new Set(ids);
    if (hasNew) {
      playNewOrder();
      vibrate(60);
      toast.info("New order near you! 🛎️");
    }
  }, [feed, online, toast]);

  async function confirmAccept() {
    if (!selected) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error ?? "Could not accept this order.";
        setError(message);
        toast.error(message);
        setAccepting(false);
        await refetchFeed();
        return;
      }
      toast.success("Order accepted — let's go! 🚀");
      router.push(`/runner/delivery/${selected.id}`);
    } catch {
      const message = "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
      setAccepting(false);
    }
  }

  const firstName = profile.full_name?.split(" ")[0] || "Runner";

  return (
    <div className="space-y-5">
      {/* Pull-to-refresh indicator */}
      {online && (pull > 0 || refreshing) && (
        <div
          className="flex items-center justify-center text-brand-600"
          style={{ height: pull }}
        >
          <RefreshCw
            className={cn("h-5 w-5", refreshing && "animate-spin")}
            style={{ transform: `rotate(${pull * 3}deg)` }}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900">
            {firstName}&apos;s hub
          </h1>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-stone-500">
            <MapPin className="h-4 w-4 text-brand-600" />
            Based in{" "}
            <span className="font-medium text-stone-700">
              {profile.delivery_zone ?? "—"}
            </span>
          </p>
        </div>
        <Link
          href="/runner/history"
          className="press flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          <History className="h-4 w-4" /> History
        </Link>
      </div>

      {/* Power switch */}
      <button
        type="button"
        onClick={toggleOnline}
        aria-pressed={online}
        className={cn(
          "press flex w-full items-center gap-4 rounded-3xl p-5 text-left transition-all duration-300",
          online
            ? "bg-brand-900 text-white shadow-soft-lg"
            : "border border-stone-200 bg-white text-stone-900 shadow-soft",
        )}
      >
        <span
          className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-300",
            online ? "bg-white/15" : "bg-stone-100",
          )}
        >
          {online && (
            <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-emerald-400" />
          )}
          <Power
            className={cn(
              "relative h-7 w-7 transition-colors",
              online ? "text-accent-400" : "text-stone-400",
            )}
          />
        </span>
        <span className="flex-1">
          <span className="block font-display text-xl font-extrabold">
            {online ? "ONLINE" : "OFFLINE"}
          </span>
          <span
            className={cn(
              "block text-sm",
              online ? "text-brand-100" : "text-stone-500",
            )}
          >
            {online ? "Receiving live orders" : "Tap to start earning"}
          </span>
        </span>
        {/* Chunky switch */}
        <span
          className={cn(
            "relative h-9 w-16 shrink-0 rounded-full transition-colors duration-300",
            online ? "bg-success" : "bg-stone-300",
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all duration-300",
              online ? "left-8" : "left-1",
            )}
          />
        </span>
      </button>

      {/* Banking-style earnings with Today / This week tabs */}
      <div className="rounded-3xl bg-brand-900 p-5 text-white shadow-soft-lg">
        <div className="flex rounded-full bg-white/10 p-0.5 text-xs font-semibold">
          <EarnTab
            active={earningsTab === "today"}
            onClick={() => setEarningsTab("today")}
          >
            Today
          </EarnTab>
          <EarnTab
            active={earningsTab === "week"}
            onClick={() => setEarningsTab("week")}
          >
            This week
          </EarnTab>
        </div>
        <p className="mt-4 font-display text-6xl font-extrabold leading-none tracking-tight text-accent-400">
          {formatCurrency(earningsTab === "today" ? todaysEarnings : weekEarnings)}
        </p>
        <p className="mt-2 text-sm text-brand-200">
          {earningsTab === "today" ? "Earned today" : "Earned this week"}
        </p>
        {weekEarnings > 0 && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <ShareButton
              variant="secondary"
              size="sm"
              className="w-full"
              label="Share my earnings"
              caption={`I've earned ${formatCurrency(weekEarnings)} on DormDrop this week! 🚀 Delivering for fellow students at Southampton.`}
              card={{
                eyebrow: "DormDrop Runner",
                headline: "Earned this week",
                stat: formatCurrency(weekEarnings),
                emoji: "🚀",
              }}
            />
          </div>
        )}
      </div>

      {/* Compact stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Bike className="h-4 w-4" />}
          label="Deliveries"
          value={String(profile.total_deliveries)}
        />
        <StatCard
          icon={<Star className="h-4 w-4" />}
          label="Rating"
          value={
            profile.runner_rating != null
              ? profile.runner_rating.toFixed(1)
              : "—"
          }
        />
        <StatCard
          icon={<Coins className="h-4 w-4" />}
          label="Payout"
          value={formatCurrency(pendingPayout)}
          accent
        />
      </div>

      {/* This week earnings chart */}
      <WeekChart data={weekData} deliveries={weekDeliveries} />

      {/* In-progress delivery resume */}
      {activeDeliveries.length > 0 && (
        <div className="space-y-2">
          {activeDeliveries.map((order) => (
            <Link
              key={order.id}
              href={`/runner/delivery/${order.id}`}
              className="press flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 transition-colors hover:bg-brand-100"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-900 text-white">
                <Bike className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand-900">
                  Delivery in progress
                </p>
                <p className="text-xs text-brand-700">
                  {order.delivery_zone} · earn{" "}
                  {formatCurrency(order.delivery_fee)}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
              <ArrowRight className="h-4 w-4 text-brand-700" />
            </Link>
          ))}
        </div>
      )}

      {/* Feed */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-stone-900">
            Available orders
          </h2>
          {online && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refetchFeed()}
                aria-label="Refresh"
                className="press rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <div className="flex rounded-full border border-stone-200 bg-stone-100 p-0.5 text-xs font-medium">
                <ScopeTab
                  active={scope === "mine"}
                  onClick={() => setScope("mine")}
                >
                  My area
                </ScopeTab>
                <ScopeTab
                  active={scope === "all"}
                  onClick={() => setScope("all")}
                >
                  All zones
                </ScopeTab>
              </div>
            </div>
          )}
        </div>

        {!online ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                <Power className="h-6 w-6" />
              </span>
              <p className="font-medium text-stone-700">You&apos;re offline</p>
              <p className="max-w-xs text-sm text-stone-500">
                Flip the switch above to see live orders near{" "}
                {profile.delivery_zone ?? "you"} and start earning.
              </p>
            </CardContent>
          </Card>
        ) : feedLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <p className="text-sm text-stone-500">Loading orders…</p>
            </CardContent>
          </Card>
        ) : feed.length === 0 ? (
          <Card>
            <EmptyState
              emoji="☕"
              title="No orders right now"
              description={
                scope === "mine"
                  ? "Grab a cuppa — we'll ping you the moment one drops nearby. Or try “All zones”."
                  : "Grab a cuppa — we'll ping you the moment a new order drops!"
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {feed.map((order) => (
              <AvailableOrderCard
                key={order.id}
                order={order}
                isNew={
                  seenIds.current !== null && !seenIds.current.has(order.id)
                }
                onAccept={(o) => {
                  setError(null);
                  setSelected(o);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Accept confirmation — bottom sheet */}
      {selected && (
        <AcceptOrderSheet
          order={selected}
          accepting={accepting}
          error={error}
          onConfirm={confirmAccept}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/** A dependency-free CSS bar chart of this week's earnings. */
function WeekChart({
  data,
  deliveries,
}: {
  data: { label: string; amount: number }[];
  deliveries: number;
}) {
  const max = Math.max(...data.map((d) => d.amount), 0);
  const bestIdx = max > 0 ? data.findIndex((d) => d.amount === max) : -1;

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-soft">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-stone-500">
          This week
        </h2>
        <span className="text-xs font-medium text-stone-400">
          {deliveries} {deliveries === 1 ? "delivery" : "deliveries"}
        </span>
      </div>

      <div className="mt-4 flex h-28 items-end gap-1.5">
        {data.map((d, i) => {
          const pct = max > 0 ? (d.amount / max) * 100 : 0;
          const best = i === bestIdx;
          return (
            <div key={i} className="flex flex-1 items-end justify-center">
              <div
                title={formatCurrency(d.amount)}
                style={{ height: `${d.amount > 0 ? Math.max(6, pct) : 2}%` }}
                className={cn(
                  "w-full rounded-t-md transition-all",
                  best ? "bg-accent-500" : "bg-brand-200",
                )}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 text-center text-[10px] font-medium",
              i === bestIdx ? "text-accent-600" : "text-stone-400",
            )}
          >
            {d.label}
          </span>
        ))}
      </div>

      <p className="mt-3 text-sm text-stone-500">
        {max > 0 ? (
          <>
            Biggest day:{" "}
            <span className="font-semibold text-stone-800">
              {data[bestIdx].label} · {formatCurrency(max)}
            </span>
          </>
        ) : (
          "No earnings yet this week — flip online to start earning."
        )}
      </p>
    </div>
  );
}

function EarnTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full py-1.5 transition-colors",
        active ? "bg-white text-brand-900" : "text-brand-100",
      )}
    >
      {children}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3 text-center",
        accent
          ? "border-accent-200 bg-accent-50"
          : "border-stone-200 bg-white shadow-soft",
      )}
    >
      <span
        className={cn(
          "mx-auto flex h-8 w-8 items-center justify-center rounded-lg",
          accent ? "bg-accent-100 text-accent-700" : "bg-brand-50 text-brand-700",
        )}
      >
        {icon}
      </span>
      <p
        className={cn(
          "mt-1.5 font-display text-base font-bold",
          accent ? "text-accent-700" : "text-stone-900",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-stone-500">{label}</p>
    </div>
  );
}

function ScopeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 transition-colors",
        active ? "bg-white text-brand-800 shadow-sm" : "text-stone-500",
      )}
    >
      {children}
    </button>
  );
}
