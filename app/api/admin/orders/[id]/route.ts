import { NextResponse, type NextRequest } from "next/server";

import { adminDb, requireAdmin } from "@/lib/admin";
import { ORDER_SELECT } from "@/lib/order-select";
import { createRouteClient } from "@/lib/supabase-server";
import type { Order, OrderStatus } from "@/types";

export const dynamic = "force-dynamic";

const VALID: OrderStatus[] = [
  "awaiting_payment",
  "pending",
  "accepted",
  "picking_up",
  "on_the_way",
  "delivered",
  "cancelled",
];

/** Timestamp a given status stamps, if not already set. */
const STAMP: Partial<Record<OrderStatus, keyof Order>> = {
  accepted: "accepted_at",
  picking_up: "picked_up_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
};

/**
 * PATCH /api/admin/orders/:id — admin override of order status (support /
 * refunds). Body: { status }. Cancelling is just a status change for now.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAdmin(createRouteClient()))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status?: OrderStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.status || !VALID.includes(body.status)) {
    return NextResponse.json({ error: "A valid status is required." }, {
      status: 400,
    });
  }

  const db = adminDb();
  const { data: existing } = await db
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const update: Record<string, unknown> = { status: body.status };
  const stamp = STAMP[body.status];
  if (stamp && !existing[stamp]) {
    update[stamp] = new Date().toISOString();
  }

  const { error } = await db.from("orders").update(update).eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", params.id)
    .single();
  return NextResponse.json({ order: data });
}
