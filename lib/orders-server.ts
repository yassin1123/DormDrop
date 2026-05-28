import type { SupabaseClient } from "@supabase/supabase-js";

import {
  COLLECTION_POINT,
  DEFAULT_ETA_MINUTES,
  DELIVERY_ZONES,
} from "@/lib/constants";
import { ORDER_SELECT } from "@/lib/order-select";
import {
  calculatePriceBreakdown,
  estimateDeliveryMinutes,
  haversineKm,
} from "@/lib/utils";
import type {
  CartLine,
  CreateOrderInput,
  Item,
  OrderStatus,
  OrderWithDetails,
} from "@/types";

export interface CreateOrderResult {
  order?: OrderWithDetails;
  error?: string;
  /** HTTP status to surface to the caller. */
  status: number;
}

export interface CreateOrderOptions {
  /**
   * Status the order is created with. Defaults to `awaiting_payment` so unpaid
   * orders never appear in the runner feed — only the Stripe webhook promotes
   * an order to `pending`.
   */
  initialStatus?: OrderStatus;
}

/**
 * Create an order (+ its line items) for a user.
 *
 * This is the single, authoritative order-creation path shared by
 * `POST /api/orders` and `POST /api/checkout`. Prices are always recomputed
 * from the database — the client's numbers are never trusted. The supplied
 * `supabase` client must carry the user's session so RLS applies.
 */
export async function createOrder(
  supabase: SupabaseClient,
  userId: string,
  input: CreateOrderInput,
  options: CreateOrderOptions = {},
): Promise<CreateOrderResult> {
  // --- Validate input -------------------------------------------------------
  if (!input?.delivery_zone || !DELIVERY_ZONES.includes(input.delivery_zone as never)) {
    return { error: "A valid delivery zone is required.", status: 400 };
  }
  if (!input.delivery_address?.trim()) {
    return { error: "A delivery address is required.", status: 400 };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { error: "Your order must contain at least one item.", status: 400 };
  }

  // Collapse duplicate item ids and sanitise quantities.
  const quantities = new Map<string, number>();
  for (const line of input.items) {
    const qty = Math.floor(Number(line.quantity));
    if (!line.item_id || !Number.isFinite(qty) || qty <= 0) {
      return {
        error: "Each line must have a valid item and quantity.",
        status: 400,
      };
    }
    quantities.set(line.item_id, (quantities.get(line.item_id) ?? 0) + qty);
  }

  // --- Authoritative prices from the DB (never trust the client) ------------
  const itemIds = [...quantities.keys()];
  const { data: dbItems, error: itemsError } = await supabase
    .from("items")
    .select("*")
    .in("id", itemIds);

  if (itemsError) {
    return { error: itemsError.message, status: 500 };
  }
  if (!dbItems || dbItems.length !== itemIds.length) {
    return { error: "One or more items could not be found.", status: 400 };
  }

  const outOfStock = (dbItems as Item[]).filter((i) => !i.in_stock);
  if (outOfStock.length > 0) {
    return {
      error: `Out of stock: ${outOfStock.map((i) => i.name).join(", ")}.`,
      status: 409,
    };
  }

  const lines: CartLine[] = (dbItems as Item[]).map((item) => ({
    item,
    quantity: quantities.get(item.id) ?? 0,
  }));
  // Coordinates are optional; only use/persist them when both are finite.
  const lat = Number(input.delivery_lat);
  const lng = Number(input.delivery_lng);
  const hasCoords =
    input.delivery_lat != null &&
    input.delivery_lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  // Distance-based delivery fee + ETA, recomputed server-side from the
  // collection point (the client's numbers are never trusted).
  const distanceKm = hasCoords
    ? haversineKm(COLLECTION_POINT, { lat, lng })
    : undefined;
  const breakdown = calculatePriceBreakdown(lines, distanceKm);
  const etaMinutes =
    distanceKm != null
      ? estimateDeliveryMinutes(distanceKm)
      : DEFAULT_ETA_MINUTES;

  // Assign the nearest active collection point (the SUSU hub is the fallback
  // when there are no coordinates). Best-effort — skipped if the table isn't
  // there yet (migration 0010).
  let collectionPointId: string | null = null;
  const { data: points } = await supabase
    .from("collection_points")
    .select("id, name, lat, lng")
    .eq("is_active", true);
  if (points && points.length > 0) {
    if (hasCoords) {
      let best = points[0];
      let bestDist = Infinity;
      for (const p of points) {
        const d = haversineKm(
          { lat: Number(p.lat), lng: Number(p.lng) },
          { lat, lng },
        );
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      collectionPointId = best.id as string;
    } else {
      collectionPointId =
        (points.find((p) => /SUSU/i.test(String(p.name)))?.id as string) ??
        (points[0].id as string);
    }
  }

  const orderPayload: {
    requester_id: string;
    status: OrderStatus;
    delivery_zone: string;
    delivery_address: string;
    delivery_notes: string | null;
    subtotal: number;
    delivery_fee: number;
    platform_fee: number;
    total: number;
    estimated_delivery_minutes: number;
    delivery_lat?: number;
    delivery_lng?: number;
    collection_point_id?: string;
  } = {
    requester_id: userId,
    status: options.initialStatus ?? "awaiting_payment",
    delivery_zone: input.delivery_zone,
    delivery_address: input.delivery_address.trim(),
    delivery_notes: input.delivery_notes?.trim() || null,
    subtotal: breakdown.subtotal,
    delivery_fee: breakdown.delivery_fee,
    platform_fee: breakdown.platform_fee,
    total: breakdown.total,
    estimated_delivery_minutes: etaMinutes,
  };
  if (hasCoords) {
    orderPayload.delivery_lat = lat;
    orderPayload.delivery_lng = lng;
  }
  if (collectionPointId) orderPayload.collection_point_id = collectionPointId;

  // --- Insert order ---------------------------------------------------------
  let insert = await supabase
    .from("orders")
    .insert(orderPayload)
    .select("id")
    .single();

  // If a newer column doesn't exist yet (migration 0008 / 0010 not applied),
  // drop the optional fields and retry so checkout keeps working.
  if (
    insert.error &&
    /column|schema cache|delivery_l|collection_point/i.test(
      insert.error.message,
    )
  ) {
    delete orderPayload.delivery_lat;
    delete orderPayload.delivery_lng;
    delete orderPayload.collection_point_id;
    insert = await supabase
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();
  }

  const created = insert.data;
  if (insert.error || !created) {
    return {
      error: insert.error?.message ?? "Could not create order.",
      status: 500,
    };
  }

  // --- Insert line items (roll back the order if this fails) ----------------
  const lineRows = lines.map((line) => ({
    order_id: created.id,
    item_id: line.item.id,
    quantity: line.quantity,
    price_at_time: line.item.price,
  }));

  const { error: lineError } = await supabase
    .from("order_items")
    .insert(lineRows);

  if (lineError) {
    await supabase.from("orders").delete().eq("id", created.id);
    return { error: lineError.message, status: 500 };
  }

  // --- Return the fully-hydrated order --------------------------------------
  const { data: full, error: fetchError } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", created.id)
    .single();

  if (fetchError || !full) {
    return { error: "Order created but could not be loaded.", status: 500 };
  }

  return { order: full as unknown as OrderWithDetails, status: 201 };
}
