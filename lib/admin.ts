import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase-server";

/**
 * Resolve the current user only if they're an active admin.
 *
 * Pass a session-aware client (createServerClient in pages/layouts,
 * createRouteClient in route handlers). The is_admin check reads the user's own
 * profile under RLS. Returns null for anyone who isn't an admin (or is
 * suspended), so callers can redirect / 403.
 */
export async function requireAdmin(
  client: SupabaseClient,
): Promise<User | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data } = await client
    .from("profiles")
    .select("is_admin, is_suspended")
    .eq("id", user.id)
    .single();

  if (!data?.is_admin || data.is_suspended) return null;
  return user;
}

/**
 * Service-role client for admin data access. ALWAYS call after `requireAdmin`
 * has confirmed the caller — this bypasses RLS.
 */
export function adminDb(): SupabaseClient {
  return createAdminClient();
}
