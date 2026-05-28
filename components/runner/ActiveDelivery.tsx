"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Loader2,
  MapPin,
  Navigation,
  Package2,
  PartyPopper,
  ShoppingBag,
  Store,
  XCircle,
} from "lucide-react";

import { DeliveryMap } from "@/components/map/DeliveryMap";
import { Confetti } from "@/components/runner/Confetti";
import { useToast } from "@/components/feedback/ToastProvider";
import { ShareButton } from "@/components/share/ShareButton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useCollectionPoint } from "@/hooks/useCollectionPoint";
import { useLocationBroadcast } from "@/hooks/useLocationBroadcast";
import { useOrderSubscription } from "@/hooks/useOrderSubscription";
import { COLLECTION_POINT } from "@/lib/constants";
import { playChaChing, vibrate } from "@/lib/sounds";
import { cn, formatCurrency } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

const BROADCAST_STATUSES: OrderWithDetails["status"][] = [
  "accepted",
  "picking_up",
  "on_the_way",
];

const STEPS = ["Pick up", "Deliver", "Done"] as const;

/** Map an order status to the active-delivery step index (0-based). */
function stepForStatus(status: OrderWithDetails["status"]): number {
  if (status === "accepted") return 0;
  if (status === "picking_up" || status === "on_the_way") return 1;
  if (status === "delivered") return 2;
  return 0;
}

export function ActiveDelivery({
  initialOrder,
}: {
  initialOrder: OrderWithDetails;
}) {
  const router = useRouter();
  const toast = useToast();
  const { order, refresh } = useOrderSubscription(
    initialOrder.id,
    initialOrder,
  );
  const current = order ?? initialOrder;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);

  // Broadcast our location while the delivery is live (stops + clears on
  // complete/cancel via the hook's cleanup).
  const { permission, position } = useLocationBroadcast(
    BROADCAST_STATUSES.includes(current.status),
  );

  const destination =
    current.delivery_lat != null && current.delivery_lng != null
      ? { lat: Number(current.delivery_lat), lng: Number(current.delivery_lng) }
      : null;
  const navHref = destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=walking`
    : null;

  // Pickup hub for this order (falls back to the SUSU hub if not assigned).
  const cp = useCollectionPoint(current.collection_point_id);
  const pickup = cp ? { lat: cp.lat, lng: cp.lng } : COLLECTION_POINT;
  const pickupName = cp?.name ?? "DormDrop Hub — SUSU";
  const pickupAddress = cp?.address ?? "Highfield Campus";
  const pickupNavHref = `https://www.google.com/maps/dir/?api=1&destination=${pickup.lat},${pickup.lng}&travelmode=walking`;

  async function advance(status: "picking_up" | "delivered") {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      if (status === "delivered") {
        playChaChing();
        vibrate(200);
      }
      await refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
      });
      // BUG FIX: this previously showed the "released" toast and navigated away
      // unconditionally (in a `finally`), so a failed release — e.g. the order
      // was already delivered/cancelled — still told the runner it worked. Only
      // confirm + leave when the API actually released it.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't release this delivery.");
      }
      toast.info("Delivery released back to the pool.");
      router.push("/runner");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  // The order left this runner's hands (requester cancelled, or released).
  if (current.status === "cancelled" || current.status === "pending") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <XCircle className="h-7 w-7" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-slate-900">
          {current.status === "cancelled"
            ? "This order was cancelled"
            : "Delivery released"}
        </h1>
        <p className="mt-2 text-slate-500">
          No worries — there are more orders waiting.
        </p>
        <Link href="/runner" className="mt-6 inline-block">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  const step = stepForStatus(current.status);
  const itemCount = current.order_items.reduce((n, li) => n + li.quantity, 0);

  // STEP 3 — complete
  if (step === 2) {
    return (
      <>
        <Confetti />
        <div className="mx-auto max-w-md py-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <PartyPopper className="h-10 w-10" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-slate-900">
            Delivery complete! 🎉
          </h1>
          <p className="mt-2 text-slate-500">
            Nice work, that&apos;s another one done.
          </p>

          <div className="mt-6 rounded-2xl bg-brand-900 px-6 py-8 text-white shadow-lg">
            <p className="text-sm text-brand-200">You earned</p>
            <p className="font-display text-6xl font-extrabold leading-none text-accent-400">
              {formatCurrency(current.delivery_fee)}
            </p>
          </div>

          <div className="mt-6 space-y-2">
            <ShareButton
              variant="secondary"
              size="lg"
              className="w-full"
              label="Share the win"
              caption={`Just completed a DormDrop delivery and earned ${formatCurrency(current.delivery_fee)}! 🚀 Runner life at Southampton.`}
              card={{
                eyebrow: "DormDrop Runner",
                headline: "Delivery complete!",
                stat: formatCurrency(current.delivery_fee),
                emoji: "🎉",
              }}
            />
            <Link href="/runner" className="inline-block w-full">
              <Button size="lg" variant="outline" className="w-full">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-xl pb-28">
      <Link
        href="/runner"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Order #{current.id.slice(0, 8)}
        </h1>
        <span className="font-display text-lg font-extrabold text-emerald-600">
          {formatCurrency(current.delivery_fee)}
        </span>
      </div>

      <ProgressDots current={step} />

      {/* Non-blocking location-permission nudge */}
      {(permission === "denied" || permission === "unsupported") && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {permission === "denied"
              ? "Enable location for live tracking so your requester can see you on the way."
              : "Location isn't available on this device — live tracking is off."}
          </span>
        </div>
      )}

      <div className="mt-6">
        {step === 0 ? (
          <StepCard
            icon={<Store className="h-5 w-5" />}
            kicker="Step 1 of 2"
            title="Head to the pickup point"
            subtitle="Collect everything on this list."
          >
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Pick up from
              </p>
              <p className="mt-1 text-lg font-bold leading-snug text-slate-900">
                {pickupName}
              </p>
              <p className="text-sm text-slate-600">
                {pickupAddress}
                {cp?.opening_hours ? ` · ${cp.opening_hours}` : ""}
              </p>
            </div>

            <DeliveryMap
              destination={pickup}
              self={position}
              className="mt-3 h-44 w-full overflow-hidden rounded-2xl border border-stone-200"
            />
            <a
              href={pickupNavHref}
              target="_blank"
              rel="noopener noreferrer"
              className="press mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              <Navigation className="h-4 w-4 text-brand-700" /> Navigate to pickup
            </a>

            <p className="mt-4 mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <Package2 className="h-3.5 w-3.5" />
              {itemCount} {itemCount === 1 ? "item" : "items"} to grab
            </p>
            <ul className="space-y-2">
              {current.order_items.map((li) => (
                <li
                  key={li.id}
                  className="flex items-center gap-3 rounded-2xl bg-stone-50 px-4 py-3.5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-base font-bold text-brand-800 shadow-sm">
                    {li.quantity}
                  </span>
                  <span className="text-base font-semibold text-slate-800">
                    {li.item.name}
                  </span>
                </li>
              ))}
            </ul>

            {error && <ErrorNote message={error} />}
          </StepCard>
        ) : (
          <StepCard
            icon={<MapPin className="h-5 w-5" />}
            kicker="Step 2 of 2"
            title="Deliver to the requester"
            subtitle="Take it to their door."
          >
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                {current.delivery_zone}
              </p>
              <p className="mt-1 text-xl font-bold leading-snug text-slate-900">
                {current.delivery_address}
              </p>
              {current.delivery_notes && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <span className="text-lg leading-none" aria-hidden>
                    📝
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                      Delivery notes
                    </p>
                    <p className="text-sm font-medium text-amber-900">
                      {current.delivery_notes}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {destination && (
              <div className="mt-4 space-y-3">
                <DeliveryMap
                  destination={destination}
                  self={position}
                  collectionPoint={{
                    lat: pickup.lat,
                    lng: pickup.lng,
                    label: pickupName,
                  }}
                  className="h-48 w-full overflow-hidden rounded-2xl border border-stone-200"
                />
                {navHref && (
                  <a
                    href={navHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="press flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-sm font-semibold text-stone-800 hover:bg-stone-50"
                  >
                    <Navigation className="h-4 w-4 text-brand-700" /> Navigate to
                    delivery
                  </a>
                )}
              </div>
            )}

            {error && <ErrorNote message={error} />}
          </StepCard>
        )}
      </div>

      {/* Escape hatch — small + out of the way so it isn't tapped by accident */}
      <button
        type="button"
        onClick={() => setReleaseOpen(true)}
        className="mx-auto mt-6 block text-xs font-medium text-slate-400 hover:text-rose-600"
      >
        Problem? Cancel delivery
      </button>

      {/* Huge sticky primary action — usable one-thumb while walking */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={() => advance(step === 0 ? "picking_up" : "delivered")}
            disabled={busy}
            className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-900 text-base font-bold text-white shadow-soft hover:bg-brand-800 disabled:opacity-70"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : step === 0 ? (
              <ShoppingBag className="h-5 w-5" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            {step === 0
              ? "I've picked up the items"
              : "I've delivered the order"}
          </button>
        </div>
      </div>

      <Modal
        open={releaseOpen}
        onClose={() => (busy ? undefined : setReleaseOpen(false))}
        title="Cancel this delivery?"
        description="It'll go back to the pool for another runner to pick up. You won't be paid for it."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setReleaseOpen(false)}
              disabled={busy}
            >
              Keep delivering
            </Button>
            <Button variant="danger" onClick={release} isLoading={busy}>
              Yes, cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          Only do this if you genuinely can&apos;t complete the delivery —
          frequent cancellations affect your standing.
        </p>
      </Modal>
    </div>
  );
}

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="mt-5 flex items-center gap-2">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                done || active
                  ? "bg-brand-900 text-white"
                  : "bg-slate-200 text-slate-500",
                active && "animate-glow",
              )}
            >
              {active && (
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500" />
              )}
              {done ? (
                <Check className="h-5 w-5" />
              ) : (
                <span className="relative">{i + 1}</span>
              )}
            </span>
            <span
              className={cn(
                "text-sm font-semibold",
                active
                  ? "text-slate-900"
                  : done
                    ? "text-slate-600"
                    : "text-slate-400",
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "h-1 flex-1 rounded",
                  done ? "bg-brand-500" : "bg-slate-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepCard({
  icon,
  kicker,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            {icon}
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
              {kicker}
            </p>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {title}
            </h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="mt-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
      {message}
    </p>
  );
}
