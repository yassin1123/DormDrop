import { NextResponse, type NextRequest } from "next/server";

import { createRouteClient } from "@/lib/supabase-server";

// Exchanges the auth code on each visit — never statically prerendered.
export const dynamic = "force-dynamic";

/**
 * OAuth / email-confirmation callback. Supabase redirects here with a `code`
 * that we exchange for a session cookie, then forward the user on.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/requester";

  if (code) {
    const supabase = createRouteClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
