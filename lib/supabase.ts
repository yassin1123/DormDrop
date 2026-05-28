/**
 * Browser-side Supabase client (Client Components).
 *
 * This module is import-safe everywhere because it never touches `next/headers`.
 * Server-only factories (server components, route handlers, admin/service-role)
 * live in `lib/supabase-server.ts` — keeping them apart is required by the App
 * Router: any module that imports `next/headers` cannot be pulled into a Client
 * Component bundle.
 */
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/** Browser-side client for use inside Client Components. */
export function createBrowserClient() {
  return createClientComponentClient();
}

// Alias matching the name from the project spec.
export { createBrowserClient as createClientComponentClient };
