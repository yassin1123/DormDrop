/**
 * Stripe configuration.
 *
 * - `stripe`            -> server-side Stripe SDK (secret key). Lazily created
 *                          so importing this module in the browser bundle never
 *                          throws and the secret is only read on the server.
 * - `getStripeJs`       -> client-side Stripe.js loader (publishable key).
 */
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import Stripe from "stripe";

/** Pinned API version — matches the installed Stripe SDK's typed default. */
export const STRIPE_API_VERSION = "2024-06-20";

let stripeSingleton: Stripe | null = null;

/** Server-side Stripe client. Throws if the secret key is missing. */
export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("getStripe: STRIPE_SECRET_KEY is not set.");
  }

  stripeSingleton = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    appInfo: { name: "DormDrop" },
  });

  return stripeSingleton;
}

let stripeJsPromise: Promise<StripeJs | null> | null = null;

/** Client-side Stripe.js loader, memoised so the script loads once. */
export function getStripeJs(): Promise<StripeJs | null> {
  if (!stripeJsPromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error(
        "getStripeJs: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set.",
      );
    }
    stripeJsPromise = loadStripe(publishableKey);
  }
  return stripeJsPromise;
}
