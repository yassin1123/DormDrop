"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Minus, Plus, X } from "lucide-react";

import { ITEM_CATEGORIES } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import type { Item } from "@/types";

interface ItemDetailSheetProps {
  item: Item;
  /** Quantity already in the cart for this item (0 if none). */
  cartQuantity: number;
  onClose: () => void;
  /** Set the cart quantity for this item to `quantity` (SET, not increment). */
  onConfirm: (item: Item, quantity: number) => void;
}

/**
 * Quick item detail view: a bottom sheet on mobile (slides up, drag-to-dismiss)
 * and a centred modal on desktop. Picks a quantity then writes it to the cart.
 */
export function ItemDetailSheet({
  item,
  cartQuantity,
  onClose,
  onConfirm,
}: ItemDetailSheetProps) {
  const category = ITEM_CATEGORIES.find((c) => c.value === item.category);

  // Stepper starts at the cart quantity, or 1 if the item isn't in the cart.
  const [qty, setQty] = useState(() => Math.max(1, cartQuantity));

  // Drag-to-dismiss (mobile) + animated close.
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  // Close on Escape; lock body scroll while open.
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
    startY.current = e.touches[0]?.clientY ?? null;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (startY.current === null) return;
    const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
    if (dy > 0) setDragY(dy);
  }
  function handleTouchEnd() {
    if (dragY > 100) {
      requestClose();
    } else {
      setDragY(0);
    }
    startY.current = null;
  }

  const lineTotal = item.price * qty;
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
      aria-label={item.name}
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
        {/* Drag handle (mobile only) */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 sm:hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <span className="h-1.5 w-10 rounded-full bg-stone-300" aria-hidden />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Image */}
          <div className="relative h-48 w-full overflow-hidden bg-white">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.name}
                fill
                sizes="(max-width: 640px) 100vw, 28rem"
                className="object-contain p-6"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-7xl drop-shadow-md" aria-hidden>
                  {category?.emoji ?? "📦"}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="press absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-sm backdrop-blur hover:text-stone-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Details */}
          <div className="px-5 pb-2 pt-4">
            {category && (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                {category.label}
              </span>
            )}
            <h2 className="mt-1 font-display text-xl font-bold leading-snug text-stone-900">
              {item.name}
            </h2>
            {item.description && (
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {item.description}
              </p>
            )}
            <p className="mt-3 font-display text-2xl font-bold text-stone-900">
              {formatCurrency(item.price)}
            </p>

            {/* Quantity stepper (centred, large) */}
            <div className="mt-5 flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                aria-label="Decrease quantity"
                className="press flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-200 text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-40"
              >
                <Minus className="h-6 w-6" />
              </button>
              <span
                key={qty}
                className="w-12 animate-pop-in text-center font-display text-3xl font-bold tabular-nums text-stone-900"
              >
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                aria-label="Increase quantity"
                className="press flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-900 text-white transition-colors hover:bg-brand-800"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer action */}
        <div className="shrink-0 border-t border-stone-100 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              onConfirm(item, qty);
              requestClose();
            }}
            className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-900 text-base font-semibold text-white shadow-soft hover:bg-brand-800"
          >
            <span>{cartQuantity > 0 ? "Update Order" : "Add to Order"}</span>
            <span className="text-brand-200">·</span>
            <span>{formatCurrency(lineTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
