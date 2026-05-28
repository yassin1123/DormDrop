/**
 * Server-side Supabase clients.
 *
 * - `createServerClient`  -> Server Components / layouts / pages
 * - `createRouteClient`   -> Route Handlers (app/api/.../route.ts)
 * - `createAdminClient`   -> server-only, bypasses RLS (service-role key)
 *
 * This module imports `next/headers`, so it must NEVER be imported by a Client
 * Component. The browser client lives in `lib/supabase.ts`. The first two
 * wrappers carry the authenticated user's cookie session through so Row Level
 * Security applies; only use the admin client where you truly need to bypass
 * RLS (e.g. the Stripe webhook).
 */
import {
  createRouteHandlerClient,
  createServerComponentClient,
} from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Server-side client for Server Components, layouts and pages. */
export function createServerClient() {
  return createServerComponentClient({ cookies });
}

/** Client for Route Handlers (app/api). Reads/writes the session cookie. */
export function createRouteClient() {
  return createRouteHandlerClient({ cookies });
}

/**
 * Privileged client that bypasses RLS using the service-role key.
 * SERVER ONLY — never import this into a Client Component. Throws if the key
 * is missing so misconfiguration fails loudly instead of silently 401-ing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Backwards-compatible aliases matching the names from the project spec.
export {
  createServerClient as createServerComponentClient,
  createRouteClient as createRouteHandlerClient,
};
