import type { ItemCategory, OrderStatus, UserRole } from "@/types";

/**
 * Halls / areas DormDrop delivers to around the University of Southampton.
 * Ordered roughly by student-residence density.
 */
export const DELIVERY_ZONES = [
  "Glen Eyre",
  "Wessex Lane",
  "Highfield Hall",
  "Erasmus Park",
  "Mayflower",
  "City Gateway",
  "Archers Road",
  "Orion Point",
  "Portswood",
  "Swaythling",
  "Bassett",
  "Highfield",
  "City Centre",
] as const;

export type DeliveryZone = (typeof DELIVERY_ZONES)[number];

/**
 * Rough geographic clusters of zones. Used to surface "nearby" orders to a
 * runner without real geocoding. Each zone's neighbours are the other members
 * of its cluster.
 */
export const ZONE_CLUSTERS: string[][] = [
  // North / Highfield campus belt
  ["Glen Eyre", "Wessex Lane", "Highfield Hall", "Highfield", "Bassett"],
  // Central / east residential
  ["Portswood", "Swaythling", "Archers Road"],
  // City & waterside
  ["Mayflower", "City Gateway", "Orion Point", "Erasmus Park", "City Centre"],
];

/**
 * Zones near a given zone (its cluster, excluding itself). Returns [] for an
 * unknown/empty zone.
 */
export function getNearbyZones(zone: string | null | undefined): string[] {
  if (!zone) return [];
  const cluster = ZONE_CLUSTERS.find((c) => c.includes(zone));
  return cluster ? cluster.filter((z) => z !== zone) : [];
}

/** A zone plus its neighbours — the set a runner sees by default. */
export function getZonesInRange(zone: string | null | undefined): string[] {
  if (!zone) return [];
  return [zone, ...getNearbyZones(zone)];
}

/**
 * Approximate centre coordinates for each delivery zone (around the University
 * of Southampton). Used to drop pins on the landing map and to auto-detect the
 * nearest zone from a chosen delivery address.
 */
export const ZONE_COORDS: Record<string, { lat: number; lng: number }> = {
  "Glen Eyre": { lat: 50.9345, lng: -1.3982 },
  "Wessex Lane": { lat: 50.9397, lng: -1.3841 },
  "Highfield Hall": { lat: 50.9344, lng: -1.3945 },
  "Erasmus Park": { lat: 50.9219, lng: -1.4042 },
  Mayflower: { lat: 50.9088, lng: -1.4072 },
  "City Gateway": { lat: 50.9091, lng: -1.4033 },
  "Archers Road": { lat: 50.9287, lng: -1.3926 },
  "Orion Point": { lat: 50.9098, lng: -1.4009 },
  Portswood: { lat: 50.928, lng: -1.387 },
  Swaythling: { lat: 50.9401, lng: -1.3775 },
  Bassett: { lat: 50.939, lng: -1.406 },
  Highfield: { lat: 50.933, lng: -1.392 },
  "City Centre": { lat: 50.9049, lng: -1.4043 },
};

/** Geographic centre of the served area — used to centre the landing map. */
export const SOUTHAMPTON_CENTER = { lat: 50.9281, lng: -1.3953 };

/**
 * The notional collection point (Highfield Campus) that distance-based delivery
 * fees and ETAs are measured from. Stand-in for a real shop until per-item
 * sourcing exists.
 */
export const COLLECTION_POINT = { lat: 50.9354, lng: -1.3964 };

/**
 * The delivery zone whose centre is closest to a coordinate. Uses a plain
 * squared-distance comparison — fine at city scale. Falls back to the first
 * zone if no coordinates are known.
 */
export function nearestZone(lat: number, lng: number): string {
  let best: string = DELIVERY_ZONES[0];
  let bestDist = Infinity;
  for (const [zone, c] of Object.entries(ZONE_COORDS)) {
    const dLat = lat - c.lat;
    const dLng = lng - c.lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < bestDist) {
      bestDist = dist;
      best = zone;
    }
  }
  return best;
}

/** Item categories, with display labels and an emoji for quick scanning. */
export const ITEM_CATEGORIES: {
  value: ItemCategory;
  label: string;
  emoji: string;
}[] = [
  { value: "snacks", label: "Snacks", emoji: "🍫" },
  { value: "drinks", label: "Drinks", emoji: "🥤" },
  { value: "essentials", label: "Essentials", emoji: "🧻" },
  { value: "stationery", label: "Stationery", emoji: "✏️" },
  { value: "personal_care", label: "Personal Care", emoji: "🧴" },
  { value: "other", label: "Other", emoji: "📦" },
];

/** Platform cut, as a fraction of the item subtotal. */
export const PLATFORM_FEE_PERCENTAGE = 0.1; // 10%

/** Base fee the runner earns per delivery, in GBP. */
export const BASE_DELIVERY_FEE = 1.5; // £1.50

/** Per-extra-km surcharge on top of the base delivery fee, in GBP. */
export const PER_KM_DELIVERY_FEE = 0.5; // £0.50 / km

/**
 * Flat delivery fee charged for the MVP: £1.50 base + £0.50 for one km = £2.00.
 * Runners keep 100% of it. Swap `calculateDeliveryFee()` for real distance once
 * delivery addresses are geocoded.
 */
export const DEFAULT_DELIVERY_FEE = 2.0; // £2.00

/** Currency used everywhere in the app. */
export const CURRENCY = "GBP";
export const CURRENCY_SYMBOL = "£";

/**
 * Order statuses with a human label, a Tailwind colour set for badges, and a
 * `step` used to render progress timelines. `cancelled` sits outside the
 * happy-path progression so it has step -1.
 */
export const ORDER_STATUSES: Record<
  OrderStatus,
  {
    label: string;
    /** Tailwind classes for a badge (bg + text + ring). */
    badgeClass: string;
    /** Tailwind text colour for accents. */
    dotClass: string;
    step: number;
  }
> = {
  awaiting_payment: {
    label: "Processing payment",
    badgeClass: "bg-slate-50 text-slate-600 ring-slate-500/20",
    dotClass: "bg-slate-400",
    step: -2,
  },
  pending: {
    label: "Pending",
    badgeClass: "bg-amber-50 text-amber-700 ring-amber-600/20",
    dotClass: "bg-amber-500",
    step: 0,
  },
  accepted: {
    label: "Accepted",
    badgeClass: "bg-blue-50 text-blue-700 ring-blue-600/20",
    dotClass: "bg-blue-500",
    step: 1,
  },
  picking_up: {
    label: "Picking Up",
    badgeClass: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
    dotClass: "bg-indigo-500",
    step: 2,
  },
  on_the_way: {
    label: "On the Way",
    badgeClass: "bg-violet-50 text-violet-700 ring-violet-600/20",
    dotClass: "bg-violet-500",
    step: 3,
  },
  delivered: {
    label: "Delivered",
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dotClass: "bg-emerald-500",
    step: 4,
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "bg-rose-50 text-rose-700 ring-rose-600/20",
    dotClass: "bg-rose-500",
    step: -1,
  },
};

/** The happy-path order of statuses, used for progress UIs. */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "pending",
  "accepted",
  "picking_up",
  "on_the_way",
  "delivered",
];

/** User-facing labels for the three account roles. */
export const ROLE_LABELS: Record<UserRole, string> = {
  requester: "Requester",
  runner: "Runner",
  both: "Requester & Runner",
};

/** Default ETA shown to requesters before a runner commits to a window. */
export const DEFAULT_ETA_MINUTES = 25;

/** Friendly typical-delivery-window label shown on order cards. */
export const ETA_RANGE_LABEL = "Usually 15–25 mins";
