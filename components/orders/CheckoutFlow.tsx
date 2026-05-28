"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
} from "lucide-react";

import { useCart } from "@/components/cart/CartProvider";
import { AddressAutocomplete } from "@/components/map/AddressAutocomplete";
import { OrderStatusTracker } from "@/components/orders/OrderStatusTracker";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useOrderSubscription } from "@/hooks/useOrderSubscription";
import {
  COLLECTION_POINT,
  DELIVERY_ZONES,
  ITEM_CATEGORIES,
  nearestZone,
} from "@/lib/constants";
import {
  calculateDeliveryFee,
  cn,
  estimateDeliveryMinutes,
  formatCurrency,
  haversineKm,
  roundMoney,
} from "@/lib/utils";
import type { Profile } from "@/types";

const STEPS = [
  { n: 1, label: "Review" },
  { n: 2, label: "Delivery" },
  { n: 3, label: "Payment" },
] as const;

export function CheckoutFlow({ profile }: { profile: Profile }) {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";
  const orderId = searchParams.get("order_id");

  if (success && orderId) {
    return <ConfirmationView orderId={orderId} />;
  }

  return (
    <CheckoutSteps
      profile={profile}
      canceledOrderId={canceled ? orderId : null}
    />
  );
}

// ---------------------------------------------------------------------------
// Steps 1–3
// ---------------------------------------------------------------------------

function CheckoutSteps({
  profile,
  canceledOrderId,
}: {
  profile: Profile;
  canceledOrderId: string | null;
}) {
  const {
    lines,
    subtotal,
    deliveryFee,
    platformFee,
    hydrated,
    addItem,
    updateQuantity,
  } = useCart();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [zone, setZone] = useState(profile.delivery_zone ?? DELIVERY_ZONES[0]);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCanceledBanner, setShowCanceledBanner] = useState(
    Boolean(canceledOrderId),
  );

  // Once an address with coordinates is picked, switch to the real
  // distance-based fee + ETA (the server recomputes these authoritatively).
  const deliveryKm = coords ? haversineKm(COLLECTION_POINT, coords) : null;
  const effectiveFee =
    deliveryKm != null ? calculateDeliveryFee(deliveryKm) : deliveryFee;
  const effectiveTotal = roundMoney(subtotal + effectiveFee + platformFee);
  const etaMinutes =
    deliveryKm != null ? estimateDeliveryMinutes(deliveryKm) : null;

  const canceledHandled = useRef(false);
  useEffect(() => {
    if (!canceledOrderId || canceledHandled.current) return;
    canceledHandled.current = true;
    void fetch(`/api/orders/${canceledOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
  }, [canceledOrderId]);

  async function handlePay() {
    if (!address.trim()) {
      setError("Please add your delivery address.");
      setStep(2);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_zone: zone,
          delivery_address: address.trim(),
          delivery_notes: notes.trim() || null,
          delivery_lat: coords?.lat ?? null,
          delivery_lng: coords?.lng ?? null,
          items: lines.map((l) => ({
            item_id: l.item.id,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Could not start checkout.");
      }
      window.location.href = data.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  // Empty basket.
  if (hydrated && lines.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-3xl">
          🛒
        </div>
        <h1 className="mt-5 font-display text-xl font-bold text-stone-900">
          Your basket is empty
        </h1>
        <p className="mt-2 text-stone-500">
          Add a few things and they&apos;ll show up here.
        </p>
        <Link href="/requester" className="mt-6 inline-block">
          <Button leftIcon={<ShoppingBag className="h-4 w-4" />}>
            Browse items
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pb-28">
      <Link
        href="/requester"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to browsing
      </Link>

      <h1 className="font-display text-2xl font-bold text-stone-900">
        Checkout
      </h1>

      <Stepper current={step} />

      {showCanceledBanner && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-accent-50 px-3 py-2.5 text-sm text-accent-700">
          <span>
            Payment was cancelled — your basket is still here. Try again whenever
            you&apos;re ready.
          </span>
          <button
            type="button"
            onClick={() => setShowCanceledBanner(false)}
            className="font-medium text-accent-700 hover:text-accent-800"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* STEP 1 — Review */}
        {step === 1 && (
          <>
            <Card>
              <CardContent className="divide-y divide-stone-100 p-0">
                {lines.map((line) => (
                  <div
                    key={line.item.id}
                    className="flex items-center gap-2.5 p-3.5"
                  >
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-white">
                      {line.item.image_url ? (
                        <Image
                          src={line.item.image_url}
                          alt={line.item.name}
                          fill
                          sizes="40px"
                          className="object-contain p-0.5"
                        />
                      ) : (
                        <span className="text-lg" aria-hidden>
                          {ITEM_CATEGORIES.find(
                            (c) => c.value === line.item.category,
                          )?.emoji ?? "📦"}
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {line.item.name}
                      </p>
                      <p className="text-xs text-stone-500">
                        {formatCurrency(line.item.price)} each
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-stone-200 p-1">
                      <button
                        type="button"
                        aria-label={`Remove one ${line.item.name}`}
                        onClick={() =>
                          updateQuantity(line.item.id, line.quantity - 1)
                        }
                        className="press flex h-9 w-9 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span
                        key={line.quantity}
                        className="min-w-[1.5rem] animate-pop-in text-center text-sm font-bold tabular-nums"
                      >
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Add one ${line.item.name}`}
                        onClick={() => addItem(line.item)}
                        className="press flex h-9 w-9 items-center justify-center rounded-lg bg-brand-900 text-white hover:bg-brand-800"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="w-14 shrink-0 text-right text-sm font-semibold text-stone-900">
                      {formatCurrency(line.item.price * line.quantity)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <PriceSummary
              subtotal={subtotal}
              deliveryFee={effectiveFee}
              platformFee={platformFee}
              total={effectiveTotal}
              deliveryKm={deliveryKm ?? undefined}
            />
          </>
        )}

        {/* STEP 2 — Delivery details */}
        {step === 2 && (
          <Card>
            <CardContent className="space-y-4 p-5">
              <Select
                label="Delivery zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                options={DELIVERY_ZONES.map((z) => ({ value: z, label: z }))}
              />
              <AddressAutocomplete
                label="Address"
                required
                value={address}
                onChange={(v) => {
                  setAddress(v);
                  setCoords(null); // typing invalidates a previously picked pin
                }}
                onSelect={(a) => {
                  setAddress(a.address);
                  setCoords({ lat: a.lat, lng: a.lng });
                  setZone(nearestZone(a.lat, a.lng)); // auto-detect nearest zone
                }}
                placeholder="Start typing your address…"
                hint="Pick a suggestion so your runner finds your door."
                error={error && !address.trim() ? error : undefined}
              />
              <Textarea
                label="Delivery notes (optional)"
                placeholder="Call when you're outside, buzzer doesn't work"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>
        )}

        {/* STEP 3 — Payment */}
        {step === 3 && (
          <>
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start gap-2 text-sm text-stone-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  <div>
                    <p className="font-medium text-stone-800">{zone}</p>
                    <p>{address}</p>
                    {notes && <p className="mt-1 text-stone-400">“{notes}”</p>}
                  </div>
                </div>

                {etaMinutes != null && (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
                    <Clock className="h-4 w-4" />
                    Estimated delivery in ~{etaMinutes} mins
                  </p>
                )}

                <div className="border-t border-stone-100 pt-4">
                  <PriceSummary
                    subtotal={subtotal}
                    deliveryFee={effectiveFee}
                    platformFee={platformFee}
                    total={effectiveTotal}
                    deliveryKm={deliveryKm ?? undefined}
                    flush
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-1.5 text-xs text-stone-400">
              <Lock className="h-3.5 w-3.5" />
              Payments are securely processed by Stripe.
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur pb-safe">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
              disabled={submitting}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back
            </Button>
          )}

          {step === 1 && (
            <Button
              size="lg"
              className="flex-1"
              onClick={() => setStep(2)}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Continue · {formatCurrency(effectiveTotal)}
            </Button>
          )}
          {step === 2 && (
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                if (!address.trim()) {
                  setError("Please add your delivery address.");
                  return;
                }
                setError(null);
                setStep(3);
              }}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Continue
            </Button>
          )}
          {step === 3 && (
            <Button
              size="lg"
              className="flex-1"
              onClick={handlePay}
              isLoading={submitting}
              leftIcon={!submitting ? <Lock className="h-4 w-4" /> : undefined}
            >
              {submitting
                ? "Taking you to payment…"
                : `Place Order · ${formatCurrency(effectiveTotal)}`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Confirmation (after Stripe success redirect)
// ---------------------------------------------------------------------------

function ConfirmationView({ orderId }: { orderId: string }) {
  const { clearCart } = useCart();
  const { order, loading } = useOrderSubscription(orderId);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <CheckCircle2 className="h-9 w-9" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold text-stone-900">
        Order placed! 🎉
      </h1>
      <p className="mt-2 text-stone-500">
        We&apos;re finding you a runner. You can track everything live.
      </p>

      <Card className="mt-6 text-left">
        <CardContent className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brand-700" />
            </div>
          ) : order ? (
            <>
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-400">
                    Order
                  </p>
                  <p className="font-display font-bold text-stone-900">
                    #{order.id.slice(0, 8)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
                  <Clock className="h-4 w-4" />~
                  {order.estimated_delivery_minutes ?? 25} min
                </div>
              </div>
              <div className="pt-4">
                <OrderStatusTracker order={order} />
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-stone-500">
              Your order is confirmed.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-2">
        <Link href={`/requester/orders/${orderId}`}>
          <Button
            size="lg"
            className="w-full"
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Track Your Order
          </Button>
        </Link>
        <Link href="/requester">
          <Button variant="ghost" className="w-full">
            Back to browsing
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Stepper({ current }: { current: number }) {
  return (
    <div className="mt-5 flex items-center">
      {STEPS.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <div key={s.n} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  done
                    ? "bg-brand-600 text-white"
                    : active
                      ? "bg-brand-900 text-white"
                      : "bg-stone-200 text-stone-500",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : s.n}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  active ? "text-stone-900" : "hidden text-stone-400 sm:inline",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "mx-2 h-0.5 flex-1 rounded",
                  done ? "bg-brand-500" : "bg-stone-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PriceSummary({
  subtotal,
  deliveryFee,
  platformFee,
  total,
  deliveryKm,
  flush = false,
}: {
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  total: number;
  /** When known, shows the distance next to the delivery fee. */
  deliveryKm?: number;
  flush?: boolean;
}) {
  const body = (
    <div className="space-y-2 text-sm">
      <Row label="Subtotal" value={subtotal} />
      <Row
        label={
          deliveryKm != null
            ? `Delivery fee · ${deliveryKm.toFixed(1)}km`
            : "Delivery fee"
        }
        value={deliveryFee}
        muted
      />
      <Row label="Platform fee (10%)" value={platformFee} muted />
      <div className="flex items-baseline justify-between border-t border-stone-100 pt-3">
        <span className="font-semibold text-stone-900">Total</span>
        <span className="font-display text-2xl font-extrabold text-stone-900">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );

  if (flush) return body;
  return (
    <Card>
      <CardContent className="p-5">{body}</CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between",
        muted ? "text-xs text-stone-400" : "text-stone-500",
      )}
    >
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
