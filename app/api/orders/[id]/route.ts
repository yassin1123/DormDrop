import { NextResponse, type NextRequest } from "next/server";

import { COLLECTION_POINT } from "@/lib/constants";
import { ORDER_SELECT } from "@/lib/order-select";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { createAdminClient, createRouteClient } from "@/lib/supabase-server";
import { estimateDeliveryMinutes, haversineKm } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";

// Depends on the auth cookie — always run per request.
export const dynamic = "force-dynamic";

/**
 * Allowed runner-driven status transitions, the statuses they may come from,
 * and the timestamp each one stamps. `delivered` may follow either `picking_up`
 * (the MVP two-step flow) or `on_the_way`.
 */
const RUNNER_TRANSITIONS: Record<
  string,
  { from: OrderStatus[]; stamp?: keyof Order }
> = {
  picking_up: { from: ["accepted"], stamp: "picked_up_at" },
  on_the_way: { from: ["picking_up"] },
  delivered: { from: ["picking_up", "on_the_way"], stamp: "delivered_at" },
};

interface RouteContext {
  params: { id: string };
}

/** GET /api/orders/:id — a single order the user is allowed to see. */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  return NextResponse.json({ order: data });
}

/**
 * PATCH /api/orders/:id — mutate an order. Body is one of:
 *   { action: "claim" }            runner claims an open order (atomic RPC)
 *   { action: "cancel" }           requester cancels an awaiting/pending/accepted order
 *   { action: "release" }          assigned runner hands the order back
 *   { status: "picking_up" | ... } assigned runner advances the status
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`orders:patch:${user.id}`, 40);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  let body: {
    action?: "claim" | "cancel" | "release";
    status?: OrderStatus;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // --- Claim (atomic, race-safe via the claim_order RPC) --------------------
  // Handled before fetching the row: if another runner already claimed it, the
  // current runner can no longer SELECT it, but the RPC still gives a clean
  // "already claimed" result rather than a misleading 404.
  if (body.action === "claim") {
    const { error } = await supabase.rpc("claim_order", {
      p_order_id: params.id,
      p_runner_id: user.id,
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("already claimed")) {
        return NextResponse.json(
          { error: "Someone just grabbed this one. Try another!" },
          { status: 409 },
        );
      }
      if (message.toLowerCase().includes("authorized")) {
        return NextResponse.json(
          { error: "You can't claim this order." },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: "Could not claim this order." },
        { status: 500 },
      );
    }

    // Refine the ETA now a runner's on it — pickup time + the walk to the door.
    const { data: claimed } = await supabase
      .from("orders")
      .select("delivery_lat, delivery_lng")
      .eq("id", params.id)
      .single();
    if (claimed?.delivery_lat != null && claimed?.delivery_lng != null) {
      const distanceKm = haversineKm(COLLECTION_POINT, {
        lat: Number(claimed.delivery_lat),
        lng: Number(claimed.delivery_lng),
      });
      await supabase
        .from("orders")
        .update({
          estimated_delivery_minutes: estimateDeliveryMinutes(distanceKm),
        })
        .eq("id", params.id);
    }

    return respondWithOrder(supabase, params.id);
  }

  // --- Everything else needs the current row --------------------------------
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .single();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const isRequester = order.requester_id === user.id;
  const isAssignedRunner = order.runner_id === user.id;
  const now = new Date().toISOString();

  // --- Cancel (requester) ---------------------------------------------------
  if (body.action === "cancel") {
    if (!isRequester) {
      return NextResponse.json(
        { error: "Only the requester can cancel this order." },
        { status: 403 },
      );
    }
    if (!["awaiting_payment", "pending", "accepted"].includes(order.status)) {
      return NextResponse.json(
        { error: "This order can no longer be cancelled." },
        { status: 409 },
      );
    }
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", cancelled_at: now })
      .eq("id", order.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return finite stock if the order had already been paid (and so
    // decremented). Best-effort via the service role (RPC is server-only).
    if (
      ["pending", "accepted", "picking_up", "on_the_way"].includes(order.status)
    ) {
      await createAdminClient().rpc("increment_stock", { p_order_id: order.id });
    }

    return respondWithOrder(supabase, order.id);
  }

  // --- Release (runner hands the order back to the pool) --------------------
  if (body.action === "release") {
    if (!isAssignedRunner) {
      return NextResponse.json(
        { error: "Only the assigned runner can release this delivery." },
        { status: 403 },
      );
    }
    if (!["accepted", "picking_up", "on_the_way"].includes(order.status)) {
      return NextResponse.json(
        { error: "This delivery can no longer be released." },
        { status: 409 },
      );
    }

    // Setting runner_id back to NULL would fail the orders_update_runner RLS
    // WITH CHECK (runner_id = auth.uid()). Authorization is verified above, so
    // perform the reset with the service-role client.
    const admin = createAdminClient();
    const { error } = await admin
      .from("orders")
      .update({
        status: "pending",
        runner_id: null,
        accepted_at: null,
        picked_up_at: null,
      })
      .eq("id", order.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return respondWithOrder(supabase, order.id);
  }

  // --- Advance status (runner) ----------------------------------------------
  if (body.status) {
    const transition = RUNNER_TRANSITIONS[body.status];
    if (!transition) {
      return NextResponse.json(
        { error: "Unsupported status transition." },
        { status: 400 },
      );
    }
    if (!isAssignedRunner) {
      return NextResponse.json(
        { error: "Only the assigned runner can update this order." },
        { status: 403 },
      );
    }
    if (!transition.from.includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot move from "${order.status}" to "${body.status}".` },
        { status: 409 },
      );
    }

    const update: Record<string, unknown> = { status: body.status };
    if (transition.stamp) update[transition.stamp] = now;

    // The handle_order_delivered() trigger creates the payout + credits the
    // runner's stats when status becomes 'delivered' — no app-side bookkeeping.
    const { error } = await supabase
      .from("orders")
      .update(update)
      .eq("id", order.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return respondWithOrder(supabase, order.id);
  }

  return NextResponse.json(
    { error: "Provide an `action` or a `status`." },
    { status: 400 },
  );
}

/** Re-fetch the full order and return it. */
async function respondWithOrder(
  supabase: ReturnType<typeof createRouteClient>,
  id: string,
) {
  const { data } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .single();
  return NextResponse.json({ order: data });
}
