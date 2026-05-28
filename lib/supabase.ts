/**
 * Browser-side Supabase client (Client Components).
 *
 * This module is import-safe everywhere because it never touches `next/headers`.
 * Server-only factories (server components, route handlers, admin/service-role)
 * live in `lib/supabase-server.ts` — keeping them apart is required by the App
 * Router: any module that imports `next/headers` cannot be pulled into a Client
 * Component bundle.
 *
 * Uses `@supabase/ssr` (the supported successor to `auth-helpers`), which is
 * Edge-runtime safe — `auth-helpers` pulled Node-only code that crashed the
 * Vercel Edge middleware with "__dirname is not defined".
 */
import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

/** Browser-side client for use inside Client Components. */
export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Alias matching the name from the project spec.
export { createBrowserClient as createClientComponentClient };
