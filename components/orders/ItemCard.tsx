"use client";

import Image from "next/image";
import { Minus, Plus, ShoppingBag } from "lucide-react";

import { ITEM_CATEGORIES } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import type { Item } from "@/types";

interface ItemCardProps {
  item: Item;
  /** Current quantity in the cart for this item. */
  quantity: number;
  onAdd: (item: Item) => void;
  onRemove: (item: Item) => void;
  /** Tapping the card body (not the action buttons) opens the detail sheet. */
  onOpen?: (item: Item) => void;
}

/** Deliveroo-style catalogue card: tall photo on white, quick-add. */
export function ItemCard({
  item,
  quantity,
  onAdd,
  onRemove,
  onOpen,
}: ItemCardProps) {
  const category = ITEM_CATEGORIES.find((c) => c.value === item.category);
  const soldOut = !item.in_stock;
  const inCart = quantity > 0;
  const openable = Boolean(onOpen);
  const lowStock =
    item.stock_quantity != null &&
    item.stock_quantity > 0 &&
    item.stock_quantity < 5;

  return (
    <div
      role={openable ? "button" : undefined}
      tabIndex={openable ? 0 : undefined}
      onClick={openable ? () => onOpen!(item) : undefined}
      onKeyDown={
        openable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen!(item);
              }
            }
          : undefined
      }
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200",
        openable &&
          "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        inCart
          ? "border-brand-300 shadow-soft ring-1 ring-brand-300"
          : "border-stone-200 shadow-soft",
        soldOut
          ? "opacity-60 grayscale"
          : "hover:-translate-y-1 hover:shadow-soft-lg",
      )}
    >
      {/* Image area */}
      <div className="relative h-36 overflow-hidden bg-white sm:h-40">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-4 transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span
              className="text-6xl drop-shadow-md transition-transform duration-300 ease-out group-hover:scale-105"
              aria-hidden
            >
              {category?.emoji ?? "📦"}
            </span>
          </div>
        )}

        {/* Category badge */}
        {category && (
          <span className="absolute left-2 top-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600 shadow-sm backdrop-blur">
            {category.label}
          </span>
        )}

        {/* Low-stock badge */}
        {lowStock && !soldOut && (
          <span className="absolute right-2 top-2 rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            {item.stock_quantity} left
          </span>
        )}

        {/* Floating quick-add (only when not in cart + in stock) */}
        {!inCart && !soldOut && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(item);
            }}
            aria-label={`Add ${item.name}`}
            className="press absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-brand-900 text-white shadow-lg ring-1 ring-black/5 transition-opacity hover:bg-brand-800 md:opacity-0 md:group-hover:opacity-100"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3">
        <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900">
          {item.name}
        </h4>
        {item.description && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-stone-500">
            {item.description}
          </p>
        )}

        <div className="mt-auto pt-3">
          <p className="font-display text-lg font-bold text-stone-900">
            {formatCurrency(item.price)}
          </p>

          <div className="mt-2">
            {soldOut ? (
              <div className="flex h-11 items-center justify-center rounded-xl bg-stone-100 text-sm font-semibold text-stone-400">
                Sold out
              </div>
            ) : inCart ? (
              <div className="flex h-11 items-center justify-between rounded-xl bg-brand-50">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item);
                  }}
                  aria-label={`Remove one ${item.name}`}
                  className="press flex h-11 w-11 items-center justify-center rounded-l-xl text-brand-700 hover:text-brand-900"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <span
                  key={quantity}
                  className="flex-1 animate-pop-in text-center text-base font-bold tabular-nums text-stone-900"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(item);
                  }}
                  aria-label={`Add one ${item.name}`}
                  className="press flex h-11 w-11 items-center justify-center"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-900 text-white hover:bg-brand-800">
                    <Plus className="h-5 w-5" />
                  </span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(item);
                }}
                className="press flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-900 text-sm font-semibold text-white hover:bg-brand-800"
              >
                <ShoppingBag className="h-4 w-4" /> Add
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
