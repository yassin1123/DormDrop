"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { calculatePriceBreakdown } from "@/lib/utils";
import type { CartLine, Item } from "@/types";

const STORAGE_KEY = "dormdrop:cart:v1";

type CartState = Record<string, CartLine>;

interface CartContextValue {
  /** Cart lines (item + quantity). */
  lines: CartLine[];
  /** Total number of units across all lines. */
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  total: number;
  /** True once the cart has hydrated from localStorage (avoids SSR flashes). */
  hydrated: boolean;
  getQuantity: (itemId: string) => number;
  addItem: (item: Item, qty?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

/**
 * Cart state, persisted to localStorage so a basket survives refreshes and
 * the Stripe redirect round-trip. Prices are derived through
 * calculatePriceBreakdown — the same function the server uses — so the preview
 * and the charge never disagree.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartState>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        if (parsed && typeof parsed === "object") setItems(parsed);
      }
    } catch {
      // Corrupt/blocked storage — start empty.
    }
    setHydrated(true);
  }, []);

  // Persist after every change (only once hydrated, so we don't clobber it).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full/blocked — ignore.
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: Item, qty = 1) => {
    setItems((prev) => {
      const current = prev[item.id]?.quantity ?? 0;
      const quantity = Math.max(1, current + qty);
      return { ...prev, [item.id]: { item, quantity } };
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    setItems((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = { item: existing.item, quantity: Math.floor(quantity) };
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => {
      if (!prev[itemId]) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setItems({}), []);

  const lines = useMemo<CartLine[]>(() => Object.values(items), [items]);
  const itemCount = useMemo(
    () => lines.reduce((n, l) => n + l.quantity, 0),
    [lines],
  );
  const breakdown = useMemo(() => calculatePriceBreakdown(lines), [lines]);
  const getQuantity = useCallback(
    (itemId: string) => items[itemId]?.quantity ?? 0,
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      itemCount,
      subtotal: breakdown.subtotal,
      deliveryFee: breakdown.delivery_fee,
      platformFee: breakdown.platform_fee,
      total: breakdown.total,
      hydrated,
      getQuantity,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [
      lines,
      itemCount,
      breakdown,
      hydrated,
      getQuantity,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Access the cart. Throws if used outside <CartProvider>. */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a <CartProvider>.");
  }
  return ctx;
}
