"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Package2 } from "lucide-react";

import { cn, formatCurrency, maskAddress } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

interface AcceptOrderSheetProps {
  order: OrderWithDetails;
  accepting: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Bottom sheet (mobile) / centred modal (desktop) shown when a runner taps an
 * available order. Earnings are big and central; the address stays masked for
 * privacy until they confirm.
 */
export function AcceptOrderSheet({
  order,
  accepting,
  error,
  onConfirm,
  onClose,
}: AcceptOrderSheetProps) {
  const itemCount = order.order_items.reduce((n, li) => n + li.quantity, 0);

  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (accepting) return; // don't let them bail mid-accept
    setClosing(true);
    window.setTimeout(onClose, 220);
  }, [accepting, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [requestClose]);

  function handleTouchStart(e: React.TouchEvent) {
    if (accepting) return;
    startY.current = e.touches[0]?.clientY ?? null;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (startY.current === null) return;
    const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
    if (dy > 0) setDragY(dy);
  }
  function handleTouchEnd() {
    if (dragY > 100) requestClose();
    else setDragY(0);
    startY.current = null;
  }

  const sheetTransform = closing
    ? "translateY(100%)"
    : dragY > 0
      ? `translateY(${dragY}px)`
      : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Accept this delivery?"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={requestClose}
        className={cn(
          "absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-200",
          closing ? "opacity-0" : "animate-fade-in opacity-100",
        )}
      />

      {/* Sheet / modal */}
      <div
        style={{ transform: sheetTransform }}
        className={cn(
          "relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-soft-lg transition-transform duration-200 ease-out sm:w-full sm:max-w-md sm:rounded-3xl",
          !closing && dragY === 0 && "animate-sheet-up sm:animate-scale-in",
        )}
      >
        {/* Drag handle */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 sm:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-stone-300" aria-hidden />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2 pt-2">
          <h2 className="text-center font-display text-lg font-bold text-stone-900">
            Accept this delivery?
          </h2>

          {/* Earnings — big, green, centred */}
          <div className="mt-4 rounded-2xl bg-emerald-50 py-5 text-center">
            <p className="text-sm font-medium text-emerald-700">
              You&apos;ll earn
            </p>
            <p className="mt-1 font-display text-5xl font-extrabold text-success">
              {formatCurrency(order.delivery_fee)}
            </p>
          </div>

          {/* Items to pick up */}
          <div className="mt-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
              <Package2 className="h-3.5 w-3.5" /> {itemCount}{" "}
              {itemCount === 1 ? "item" : "items"} to pick up
            </p>
            <ul className="space-y-1.5">
              {order.order_items.map((li) => (
                <li
                  key={li.id}
                  className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-brand-800 shadow-sm">
                    {li.quantity}
                  </span>
                  <span className="text-sm font-medium text-stone-800">
                    {li.item.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Drop-off — masked until accepted */}
          <div className="mt-5">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
              <MapPin className="h-3.5 w-3.5" /> Deliver to
            </p>
            <p className="font-display text-base font-bold text-stone-900">
              {order.delivery_zone}
            </p>
            <p className="text-sm text-stone-500">
              {maskAddress(order.delivery_address)} · full address shown once you
              accept
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700"
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 space-y-2 border-t border-stone-100 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onConfirm}
            disabled={accepting}
            className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-900 text-base font-bold text-white shadow-soft hover:bg-brand-800 disabled:opacity-70"
          >
            {accepting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Accepting…
              </>
            ) : (
              "Confirm — I'll deliver this"
            )}
          </button>
          <button
            type="button"
            onClick={requestClose}
            disabled={accepting}
            className="press h-11 w-full rounded-2xl border border-stone-300 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
