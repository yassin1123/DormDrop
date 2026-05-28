import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  CURRENCY,
  DEFAULT_DELIVERY_FEE,
  PLATFORM_FEE_PERCENTAGE,
} from "@/lib/constants";
import type { CartLine, PriceBreakdown, UserRole } from "@/types";

/** Merge conditional Tailwind class names, de-duplicating conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * The dashboard a user lands on for their role. Runners go to /runner;
 * requesters and "both" accounts default to /requester (the role switcher in
 * the navbar lets "both" jump to /runner).
 */
export function dashboardPathForRole(role: UserRole): string {
  return role === "runner" ? "/runner" : "/requester";
}

/** Round to 2 decimal places, avoiding binary float drift (e.g. 1.005). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Format a number as GBP currency (e.g. £3.50). */
export function formatCurrency(amount: number, currency = CURRENCY): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Distance-based delivery fee in GBP (runners keep 100%):
 *   < 1km  → £1.50    1–2km → £2.00    2–3km → £2.50    3km+ → £3.00
 */
export function calculateDeliveryFee(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 1) return 1.5;
  if (distanceKm < 2) return 2.0;
  if (distanceKm < 3) return 2.5;
  return 3.0;
}

/**
 * Great-circle distance between two lat/lng points, in km (Haversine).
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371; // Earth radius, km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Estimated delivery time in minutes: ~5 min at the shop plus the walk to the
 * door (≈12 min/km, a typical loaded walking pace).
 */
export function estimateDeliveryMinutes(distanceKm: number): number {
  const walk = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) * 12 : 0;
  return Math.max(5, Math.round(5 + walk));
}

/**
 * Compute the full price breakdown for a cart.
 *
 * - subtotal      = sum of item price × quantity
 * - delivery_fee  = distance-based (when `distanceKm` is known) else the flat
 *                   DEFAULT_DELIVERY_FEE; paid to the runner
 * - platform_fee  = PLATFORM_FEE_PERCENTAGE of the subtotal (DormDrop's cut)
 * - total         = subtotal + delivery_fee + platform_fee
 *
 * Keep this the single source of truth so the client preview and the server
 * never disagree on what the customer is charged.
 */
export function calculatePriceBreakdown(
  lines: CartLine[],
  distanceKm?: number,
): PriceBreakdown {
  const subtotal = roundMoney(
    lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0),
  );
  const delivery_fee =
    distanceKm != null
      ? calculateDeliveryFee(distanceKm)
      : DEFAULT_DELIVERY_FEE;
  const platform_fee = roundMoney(subtotal * PLATFORM_FEE_PERCENTAGE);
  const total = roundMoney(subtotal + delivery_fee + platform_fee);

  return { subtotal, delivery_fee, platform_fee, total };
}

/** Convert a GBP amount to integer pence for Stripe. */
export function toStripeAmount(amountGbp: number): number {
  return Math.round(amountGbp * 100);
}

/** Relative "time ago" string, e.g. "3 min ago", "2 h ago", "just now". */
export function timeAgo(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 30) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/** Format an ISO timestamp as a friendly local time (e.g. "27 May, 14:32"). */
export function formatDateTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Partially mask a delivery address for the open feed, so a requester's exact
 * location isn't exposed before a runner commits. Shows the area-ish segment
 * (the comma-part before the last), e.g. "Flat 4B, Block 3, Glen Eyre" -> "Block
 * 3". The full address is revealed in the accept modal + active delivery.
 */
export function maskAddress(address: string): string {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return "Approx. location";
}

/** Initials for an avatar fallback, e.g. "Ada Lovelace" -> "AL". */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Clamp a number into the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * A contextual home-screen message based on the time of day. Compute on the
 * client (in an effect) to avoid SSR/hydration mismatches.
 */
export function timeOfDayMessage(date = new Date()): {
  emoji: string;
  message: string;
} {
  const h = date.getHours();
  if (h >= 23 || h < 5)
    return { emoji: "🌙", message: "Late night munchies? We've got you." };
  if (h < 9)
    return { emoji: "🌅", message: "Early bird? Grab breakfast essentials." };
  if (h < 17)
    return { emoji: "📚", message: "Need a study snack? Runners are ready." };
  return { emoji: "🍿", message: "Movie night sorted. Pick your snacks." };
}
