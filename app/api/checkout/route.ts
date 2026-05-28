import { NextResponse, type NextRequest } from "next/server";

import { CURRENCY } from "@/lib/constants";
import { createOrder } from "@/lib/orders-server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";
import { createRouteClient } from "@/lib/supabase-server";
import { toStripeAmount } from "@/lib/utils";
import type { CreateOrderInput, OrderItemWithItem } from "@/types";

// Auth cookie + Stripe secret — always run per request.
export const dynamic = "force-dynamic";

/**
 * POST /api/checkout — the pay-then-place entry point.
 *
 *   1. Creates the order (status 'pending') + line items in Supabase, with
 *      prices computed server-side (lib/orders-server).
 *   2. Creates a Stripe Checkout session for the order total, passing the
 *      order id as metadata.
 *   3. Returns the hosted Stripe URL to redirect to.
 *
 * On Stripe failure the just-created order is rolled back so we never leave an
 * unpayable order behind.
 */
export async function POST(request: NextRequest) {
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`checkout:${user.id}`, 10);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  // Suspended users can't place orders.
  const { data: me } = await supabase
    .from("profiles")
    .select("is_suspended")
    .eq("id", user.id)
    .single();
  if (me?.is_suspended) {
    return NextResponse.json(
      { error: "Your account is suspended." },
      { status: 403 },
    );
  }

  let body: CreateOrderInput;
  try {
    body = (await request.json()) as CreateOrderInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // 1. Create the order — `awaiting_payment` so it stays out of the runner
  //    feed until the Stripe webhook confirms payment.
  const { order, error, status } = await createOrder(supabase, user.id, body, {
    initialStatus: "awaiting_payment",
  });
  if (error || !order) {
    return NextResponse.json({ error: error ?? "Could not create order." }, {
      status,
    });
  }

  // 2. Create the Stripe Checkout session.
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    new URL(request.url).origin;
  const currency = CURRENCY.toLowerCase();

  const lineItems = (order.order_items as OrderItemWithItem[]).map((li) => ({
    quantity: li.quantity,
    price_data: {
      currency,
      unit_amount: toStripeAmount(Number(li.price_at_time)),
      product_data: { name: li.item.name },
    },
  }));
  lineItems.push({
    quantity: 1,
    price_data: {
      currency,
      unit_amount: toStripeAmount(Number(order.delivery_fee)),
      product_data: { name: "Delivery fee" },
    },
  });
  lineItems.push({
    quantity: 1,
    price_data: {
      currency,
      unit_amount: toStripeAmount(Number(order.platform_fee)),
      product_data: { name: "DormDrop platform fee" },
    },
  });

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: user.email ?? undefined,
      success_url: `${siteUrl}/requester/checkout?success=true&order_id=${order.id}`,
      cancel_url: `${siteUrl}/requester/checkout?canceled=true&order_id=${order.id}`,
      metadata: { order_id: order.id, requester_id: user.id },
      payment_intent_data: { metadata: { order_id: order.id } },
    });

    return NextResponse.json({ url: session.url, order_id: order.id });
  } catch {
    // Roll back the unpaid order so it can't be claimed by a runner.
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json(
      { error: "Could not start payment. Please try again." },
      { status: 502 },
    );
  }
}
