"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  Clock,
  MapPin,
  Navigation,
  Package2,
  Radio,
  Star,
} from "lucide-react";

import { DeliveryMap } from "@/components/map/DeliveryMap";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderStatusTracker } from "@/components/orders/OrderStatusTracker";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { RateRunnerForm } from "@/components/reviews/RateRunnerForm";
import { ShareButton } from "@/components/share/ShareButton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useCollectionPoint } from "@/hooks/useCollectionPoint";
import { useOrderSubscription } from "@/hooks/useOrderSubscription";
import { useRunnerLocation } from "@/hooks/useRunnerLocation";
import { createBrowserClient } from "@/lib/supabase";
import {
  COLLECTION_POINT,
  ETA_RANGE_LABEL,
  getZonesInRange,
} from "@/lib/constants";
import { formatCurrency, formatDateTime, haversineKm } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

const LIVE_STATUSES: OrderWithDetails["status"][] = [
  "pending",
  "accepted",
  "picking_up",
  "on_the_way",
];

/** Friendly toast shown when a runner advances the order live. (Cancellation
 *  is handled by the cancel action itself, so it's intentionally omitted.) */
const STATUS_TOAST: Partial<Record<OrderWithDetails["status"], string>> = {
  accepted: "A runner accepted your order! 🎉",
  picking_up: "Your runner is picking up your items 🛍️",
  on_the_way: "Your order is on the way! 🚴",
  delivered: "Delivered — enjoy! 🎉",
};

export function OrderDetail({
  initialOrder,
}: {
  initialOrder: OrderWithDetails;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const { order, refresh } = useOrderSubscription(initialOrder.id, initialOrder);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [runnersOnline, setRunnersOnline] = useState<number | null>(null);

  const current = order ?? initialOrder;

  // Live runner location (null until a runner is assigned + broadcasting).
  const runnerLoc = useRunnerLocation(current.runner_id);
  const cp = useCollectionPoint(current.collection_point_id);

  const destination =
    current.delivery_lat != null && current.delivery_lng != null
      ? { lat: Number(current.delivery_lat), lng: Number(current.delivery_lng) }
      : null;
  const showTracking =
    destination != null &&
    ["pending", "accepted", "picking_up", "on_the_way"].includes(
      current.status,
    );
  const minutesAway =
    runnerLoc && destination
      ? Math.max(1, Math.round(haversineKm(runnerLoc, destination) * 12))
      : null;
  const feeKm = destination ? haversineKm(COLLECTION_POINT, destination) : null;

  // A per-minute tick so the ETA countdown + the 30-min pending timeout
  // re-evaluate without needing a realtime event.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // "Arriving in ~X mins": live from the runner's position when broadcasting,
  // otherwise counting down from the accept-time estimate.
  const inFlight = ["accepted", "picking_up", "on_the_way"].includes(
    current.status,
  );
  const arrivingMins = (() => {
    if (minutesAway != null) return minutesAway; // live recalculation
    if (
      inFlight &&
      current.accepted_at &&
      current.estimated_delivery_minutes != null
    ) {
      const elapsed =
        (now - new Date(current.accepted_at).getTime()) / 60_000;
      return Math.max(1, Math.round(current.estimated_delivery_minutes - elapsed));
    }
    return null;
  })();

  // Pending for over 30 minutes with no runner → surface a reassurance + cancel.
  const pendingStale =
    current.status === "pending" &&
    (now - new Date(current.created_at).getTime()) / 60_000 > 30;

  // Pop a friendly toast whenever the status advances live (runner-driven).
  const prevStatusRef = useRef(initialOrder.status);
  useEffect(() => {
    if (current.status === prevStatusRef.current) return;
    prevStatusRef.current = current.status;
    const message = STATUS_TOAST[current.status];
    if (message) toast.success(message);
  }, [current.status, toast]);

  // Have I already reviewed this (delivered) order?
  useEffect(() => {
    if (current.status !== "delivered" || !current.runner_id || !user) return;
    let active = true;
    const supabase = createBrowserClient();
    supabase
      .from("reviews")
      .select("id")
      .eq("order_id", current.id)
      .eq("reviewer_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setReviewed(true);
      });
    return () => {
      active = false;
    };
  }, [current.status, current.runner_id, current.id, user]);

  // While pending, check if any runners are online in this zone.
  useEffect(() => {
    if (current.status !== "pending") return;
    let active = true;
    const supabase = createBrowserClient();
    const zones = getZonesInRange(current.delivery_zone);
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["runner", "both"])
      .eq("is_online", true)
      .in("delivery_zone", zones.length ? zones : [current.delivery_zone])
      .then(({ count }) => {
        if (active) setRunnersOnline(count ?? 0);
      });
    return () => {
      active = false;
    };
  }, [current.status, current.delivery_zone]);

  async function handleCancel() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not cancel order.");
      await refresh();
      toast.success("Order cancelled.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const itemCount = current.order_items.reduce((n, li) => n + li.quantity, 0);
  const showLive = LIVE_STATUSES.includes(current.status);

  return (
    <div className="mx-auto max-w-xl pb-10">
      <Link
        href="/requester"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browsing
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-stone-900">
            Order #{current.id.slice(0, 8)}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Placed {formatDateTime(current.created_at)}
          </p>
        </div>
        <OrderStatusBadge status={current.status} />
      </div>

      {showLive && current.status !== "pending" && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600">
          <Radio className="h-3.5 w-3.5 animate-pulse" /> Live tracking on
        </p>
      )}

      <div className="mt-6 space-y-5">
        {/* Status tracker */}
        <Card>
          <CardContent className="p-5">
            <OrderStatusTracker order={current} />
            {current.status === "pending" && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-stone-500">
                <Clock className="h-4 w-4 text-brand-600" />
                {ETA_RANGE_LABEL} once a runner accepts.
              </p>
            )}
            {arrivingMins != null && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                <Clock className="h-4 w-4" />
                Arriving in ~{arrivingMins} {arrivingMins === 1 ? "min" : "mins"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Live tracking map */}
        {showTracking && destination && (
          <Card>
            <CardContent className="p-0">
              <DeliveryMap
                destination={destination}
                runner={runnerLoc}
                collectionPoint={
                  cp ? { lat: cp.lat, lng: cp.lng, label: cp.name } : undefined
                }
                className="h-56 w-full"
              />
              <div className="p-4">
                {runnerLoc ? (
                  <p className="flex items-center gap-2 text-sm font-bold text-brand-800">
                    <Navigation className="h-4 w-4 text-brand-600" />
                    Your runner is ~{minutesAway} min away
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-sm font-medium text-stone-500">
                    <Bike className="h-4 w-4 text-stone-400" />
                    {current.status === "pending"
                      ? "Waiting for a runner…"
                      : "Waiting for your runner's location…"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending too long (30 min+) — reassure + offer to bail out. */}
        {pendingStale && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <p className="flex items-start gap-2 font-medium">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              Taking longer than usual — no runners available right now. We&apos;ll
              keep trying!
            </p>
            <p className="mt-1 pl-6 text-amber-700/90">
              You can cancel below if you&apos;d rather not wait.
            </p>
          </div>
        )}

        {/* No runners online reassurance (until it's been stale a while) */}
        {current.status === "pending" && runnersOnline === 0 && !pendingStale && (
          <div className="flex items-start gap-2 rounded-xl bg-accent-50 px-3 py-2.5 text-sm text-accent-800">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Runners may be busy right now — your order will be matched as soon
              as one goes online. Hang tight!
            </span>
          </div>
        )}

        {/* Items */}
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
              <Package2 className="h-3.5 w-3.5" />
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
            <ul className="space-y-2">
              {current.order_items.map((li) => (
                <li
                  key={li.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-stone-700">
                    <span className="text-stone-400">{li.quantity}×</span>{" "}
                    {li.item.name}
                  </span>
                  <span className="text-stone-500">
                    {formatCurrency(li.price_at_time * li.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Delivery details */}
        <Card>
          <CardContent className="p-5">
            <p className="flex items-start gap-2 text-sm text-stone-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              <span>
                <span className="font-medium text-stone-800">
                  {current.delivery_zone}
                </span>
                <br />
                {current.delivery_address}
                {current.delivery_notes && (
                  <span className="mt-1 block text-stone-400">
                    “{current.delivery_notes}”
                  </span>
                )}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Runner */}
        {current.runner && (
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Bike className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-xs text-stone-400">Your runner</p>
                <p className="font-medium text-stone-900">
                  {current.runner.full_name || "Assigned"}
                </p>
              </div>
              {current.runner.runner_rating != null && (
                <span className="flex items-center gap-1 text-sm font-medium text-stone-600">
                  <Star className="h-4 w-4 fill-accent-400 text-accent-400" />
                  {current.runner.runner_rating.toFixed(1)}
                </span>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment summary */}
        <Card>
          <CardContent className="space-y-2 p-5 text-sm">
            <Row label="Subtotal" value={current.subtotal} />
            <Row
              label={
                feeKm != null
                  ? `Delivery fee · ${feeKm.toFixed(1)}km`
                  : "Delivery fee"
              }
              value={current.delivery_fee}
            />
            <Row label="Platform fee" value={current.platform_fee} />
            <div className="flex justify-between border-t border-stone-100 pt-2 font-display text-base font-bold text-stone-900">
              <span>Total paid</span>
              <span>{formatCurrency(current.total)}</span>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Actions */}
        {current.status === "pending" && (
          <Button
            variant={pendingStale ? "danger" : "outline"}
            size="lg"
            className="w-full"
            isLoading={busy}
            onClick={handleCancel}
          >
            Cancel order
          </Button>
        )}
        {current.status === "delivered" &&
          current.runner_id &&
          (reviewed ? (
            <p className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-3 text-sm font-medium text-emerald-700">
              <Star className="h-4 w-4 fill-accent-400 text-accent-400" />
              Thanks for rating this order!
            </p>
          ) : (
            <Button
              size="lg"
              className="w-full"
              leftIcon={<Star className="h-5 w-5" />}
              onClick={() => setRateOpen(true)}
            >
              Rate Your Runner
            </Button>
          ))}
        {current.status === "delivered" && (
          <ShareButton
            variant="outline"
            className="w-full"
            label="Share this delivery"
            caption={`Just got ${current.order_items
              .map((li) => li.item.name)
              .slice(0, 2)
              .join(", ")} delivered by a fellow student. Thank you DormDrop! 🌙`}
            card={{
              eyebrow: "DormDrop",
              headline: "Delivered to my door 🌙",
              subline: current.order_items
                .map((li) => `${li.quantity}× ${li.item.name}`)
                .join(" · "),
              emoji: "💧",
            }}
          />
        )}
      </div>

      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="Rate your runner"
        description="Your feedback keeps DormDrop's runners brilliant."
      >
        {current.runner_id && (
          <RateRunnerForm
            orderId={current.id}
            revieweeId={current.runner_id}
            runnerName={current.runner?.full_name}
            onDone={() => {
              setReviewed(true);
              setRateOpen(false);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-stone-500">
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
