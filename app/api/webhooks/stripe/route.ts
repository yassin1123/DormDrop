import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-server";

// Stripe needs the raw, unparsed body to verify the signature — never cache.
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe — the source of truth for payment state.
 *
 *   checkout.session.completed → promote the order awaiting_payment → pending
 *                                (now visible to runners).
 *   checkout.session.expired   → cancel the order (payment never completed).
 *   payment_intent.payment_failed → cancel the order.
 *
 * Verifies the Stripe signature, parses order_id from metadata, and uses the
 * service-role client (the caller is Stripe, not a logged-in user). Every
 * handler is guarded by the current status so redelivered events are
 * idempotent. Errors are logged, not thrown — a 400 means "bad signature", a
 * 500 asks Stripe to retry, a 200 acks.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe signature or webhook secret." },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    console.error("[stripe webhook] signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook verification failed: ${message}` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (!orderId) break;

        // Payment confirmed → make the order available to runners.
        const { data, error } = await supabase
          .from("orders")
          .update({ status: "pending" })
          .eq("id", orderId)
          .eq("status", "awaiting_payment")
          .select("id");
        if (error) throw error;

        // Only when this event actually promoted the order (idempotent across
        // redelivered webhooks): decrement finite stock. Best-effort — never
        // fail the webhook over stock bookkeeping.
        if (data && data.length > 0) {
          await supabase.rpc("decrement_stock", { p_order_id: orderId });
        }
        break;
      }

      case "checkout.session.expired":
      case "payment_intent.payment_failed": {
        const object = event.data.object as
          | Stripe.Checkout.Session
          | Stripe.PaymentIntent;
        const orderId = object.metadata?.order_id;
        if (!orderId) break;

        // Payment never completed → cancel the order if it's still waiting.
        const { error } = await supabase
          .from("orders")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq("status", "awaiting_payment");
        if (error) throw error;
        break;
      }

      default:
        // Unhandled events are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] handler error for ${event.type}:`, err);
    // 500 → Stripe will retry. Handlers are idempotent, so retries are safe.
    return NextResponse.json(
      { error: "Webhook handler failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
