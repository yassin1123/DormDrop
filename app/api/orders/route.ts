import { NextResponse, type NextRequest } from "next/server";

import { ORDER_SELECT } from "@/lib/order-select";
import { createOrder } from "@/lib/orders-server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { createRouteClient } from "@/lib/supabase-server";
import type { CreateOrderInput } from "@/types";

// Depends on the auth cookie — always run per request.
export const dynamic = "force-dynamic";

/** GET /api/orders — the signed-in user's orders (as requester). */
export async function GET() {
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
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ orders: data });
}

/**
 * POST /api/orders — create a new order + its line items. Prices are computed
 * server-side from the database (see lib/orders-server). For the full
 * pay-then-place flow use POST /api/checkout, which calls the same helper and
 * additionally creates a Stripe Checkout session.
 */
export async function POST(request: NextRequest) {
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`orders:create:${user.id}`, 10);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  let body: CreateOrderInput;
  try {
    body = (await request.json()) as CreateOrderInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { order, error, status } = await createOrder(supabase, user.id, body);
  if (error || !order) {
    return NextResponse.json({ error: error ?? "Could not create order." }, {
      status,
    });
  }
  return NextResponse.json({ order }, { status: 201 });
}
