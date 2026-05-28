"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";

import { useCart } from "@/components/cart/CartProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { ItemCard } from "@/components/orders/ItemCard";
import { ItemDetailSheet } from "@/components/orders/ItemDetailSheet";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Button } from "@/components/ui/Button";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { cn, formatCurrency, timeAgo, timeOfDayMessage } from "@/lib/utils";
import type { Item, ItemCategory, OrderWithDetails, Profile } from "@/types";

interface RequesterDashboardProps {
  profile: Profile;
  items: Item[];
  initialOrders: OrderWithDetails[];
}

export function RequesterDashboard({
  profile,
  items,
  initialOrders,
}: RequesterDashboardProps) {
  const { addItem, updateQuantity, getQuantity, itemCount, subtotal } =
    useCart();
  const router = useRouter();
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState<ItemCategory | "all">(
    "all",
  );
  const [query, setQuery] = useState("");

  // The item whose detail sheet is currently open (null = closed).
  const [selected, setSelected] = useState<Item | null>(null);

  // Time-of-day message — computed client-side to avoid hydration mismatch.
  const [contextual, setContextual] = useState<{
    emoji: string;
    message: string;
  } | null>(null);
  useEffect(() => setContextual(timeOfDayMessage()), []);

  /** Set the cart quantity for an item (absolute), used by the detail sheet. */
  const setQty = useCallback(
    (item: Item, quantity: number) => {
      if (getQuantity(item.id) === 0) addItem(item, quantity);
      else updateQuantity(item.id, quantity);
    },
    [getQuantity, addItem, updateQuantity],
  );

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory =
        activeCategory === "all" || item.category === activeCategory;
      const matchesQuery = q === "" || item.name.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [items, activeCategory, query]);

  // "Popular picks" — a few in-stock items (prefer ones with a photo).
  const quickPicks = useMemo(() => {
    const inStock = items.filter((i) => i.in_stock);
    const withImg = inStock.filter((i) => i.image_url);
    const base = withImg.length >= 4 ? withImg : inStock;
    return base.slice(0, 6);
  }, [items]);

  const showQuickPicks =
    quickPicks.length > 0 && query.trim() === "" && activeCategory === "all";

  const activeOrders = useMemo(
    () => initialOrders.filter((o) => o.status !== "cancelled"),
    [initialOrders],
  );
  const recentOrders = useMemo(() => initialOrders.slice(0, 3), [initialOrders]);

  function reorder(order: OrderWithDetails) {
    order.order_items.forEach((li) => addItem(li.item, li.quantity));
    const count = order.order_items.reduce((n, li) => n + li.quantity, 0);
    toast.success(`Added ${count} item${count === 1 ? "" : "s"} to your cart.`);
    router.push("/requester/checkout");
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="font-display text-2xl font-bold text-stone-900">
          Hey {profile.full_name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="mt-0.5 text-stone-500">
          What can we drop at {profile.delivery_zone ?? "your place"} today?
        </p>
      </div>

      {/* Contextual, time-of-day banner */}
      {contextual && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-accent-50 px-4 py-3">
          <span className="text-2xl">{contextual.emoji}</span>
          <p className="text-sm font-medium text-brand-900">
            {contextual.message}
          </p>
        </div>
      )}

      {/* Popular picks — quick-add carousel */}
      {showQuickPicks && (
        <section>
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-stone-500">
            Popular picks 🔥
          </h2>
          <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
            <div className="flex w-max gap-4">
              {quickPicks.map((item) => {
                const emoji =
                  ITEM_CATEGORIES.find((c) => c.value === item.category)
                    ?.emoji ?? "📦";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    aria-label={`Quick add ${item.name}`}
                    className="press flex w-16 shrink-0 flex-col items-center gap-1.5"
                  >
                    <span className="relative h-16 w-16">
                      <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-white shadow-soft">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            fill
                            sizes="64px"
                            className="object-contain p-2"
                          />
                        ) : (
                          <span className="text-2xl" aria-hidden>
                            {emoji}
                          </span>
                        )}
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-900 text-white shadow-sm ring-2 ring-stone-50">
                        <Plus className="h-3 w-3" />
                      </span>
                    </span>
                    <span className="line-clamp-1 w-full text-center text-[11px] font-medium leading-tight text-stone-600">
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Sticky search + category filters (pin under the navbar on scroll) */}
      <div className="sticky top-16 z-20 -mx-4 space-y-3 border-b border-stone-200/70 bg-stone-50/95 px-4 pb-3 pt-2 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search snacks, drinks, essentials…"
            aria-label="Search items"
            className="h-12 w-full rounded-2xl border border-stone-200 bg-white pl-11 pr-10 text-sm text-stone-900 shadow-soft transition-colors placeholder:text-stone-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="press absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category chips (horizontal scroll) */}
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2">
            <CategoryChip
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            >
              ✨ All
            </CategoryChip>
            {ITEM_CATEGORIES.map((c) => (
              <CategoryChip
                key={c.value}
                active={activeCategory === c.value}
                onClick={() => setActiveCategory(c.value)}
              >
                {c.emoji} {c.label}
              </CategoryChip>
            ))}
          </div>
        </div>
      </div>

      {/* Catalogue grid */}
      {visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 py-16 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-3 font-medium text-stone-700">No items found</p>
          <p className="text-sm text-stone-500">
            Try a different search or category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              quantity={getQuantity(item.id)}
              onAdd={(it) => addItem(it)}
              onRemove={(it) => updateQuantity(it.id, getQuantity(it.id) - 1)}
              onOpen={(it) => setSelected(it)}
            />
          ))}
        </div>
      )}

      {/* Active orders */}
      {activeOrders.length > 0 && (
        <section id="orders" className="scroll-mt-20 pt-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-stone-900">
              Your orders
            </h2>
            <Link
              href="/requester/orders"
              className="flex items-center gap-0.5 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {activeOrders.slice(0, 2).map((order) => (
              <Link
                key={order.id}
                href={`/requester/orders/${order.id}`}
                className="press block"
              >
                <OrderCard order={order} perspective="requester" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Your recent orders — quick re-order */}
      {recentOrders.length > 0 && (
        <section className="pt-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-stone-900">
              Your recent orders
            </h2>
            <Link
              href="/requester/orders"
              className="flex items-center gap-0.5 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map((order) => {
              const count = order.order_items.reduce(
                (n, li) => n + li.quantity,
                0,
              );
              return (
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
                  className="press flex cursor-pointer items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <OrderStatusBadge status={order.status} />
                      <span className="text-xs text-stone-400">
                        {timeAgo(order.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-stone-600">
                      {count} {count === 1 ? "item" : "items"} ·{" "}
                      <span className="font-semibold text-stone-900">
                        {formatCurrency(order.total)}
                      </span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<RotateCcw className="h-4 w-4" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      reorder(order);
                    }}
                  >
                    Reorder
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Floating cart bar → checkout (sits above the mobile tab bar) */}
      {itemCount > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-4">
          {/* Subtle frosted fade so the bar floats over scrolling content. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-stone-50 via-stone-50/70 to-transparent" />
          <Link
            key={itemCount}
            href="/requester/checkout"
            className="press pointer-events-auto mx-auto flex w-full max-w-md animate-cart-pop items-center gap-3 rounded-2xl bg-brand-900 p-3 text-white shadow-soft-lg ring-1 ring-black/5"
          >
            <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent-500 px-1 text-xs font-bold text-brand-950">
                {itemCount}
              </span>
            </span>
            <span className="flex-1 text-left">
              <span className="block text-sm font-bold">View Cart</span>
              <span className="block text-xs text-brand-200">
                {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
                {formatCurrency(subtotal)}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-brand-200" />
          </Link>
        </div>
      )}

      {/* Item detail sheet (bottom sheet on mobile, centred modal on desktop) */}
      {selected && (
        <ItemDetailSheet
          item={selected}
          cartQuantity={getQuantity(selected.id)}
          onClose={() => setSelected(null)}
          onConfirm={setQty}
        />
      )}
    </div>
  );
}

function CategoryChip({
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
        "press whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-brand-900 bg-brand-900 text-white"
          : "border-stone-200 bg-white text-stone-600 hover:border-brand-300 hover:bg-brand-50",
      )}
    >
      {children}
    </button>
  );
}
