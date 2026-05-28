import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse, type NextRequest } from "next/server";

import type { UserRole } from "@/types";

/** Dashboard a role lands on. Mirrors lib/utils dashboardPathForRole (inlined
 *  here to keep the edge middleware bundle lean). */
function dashboardForRole(role: UserRole): string {
  return role === "runner" ? "/runner" : "/requester";
}

/**
 * Middleware responsibilities:
 *  1. Refresh the Supabase session cookie on every request.
 *  2. Gate /requester/*, /runner/*, /admin/* behind authentication.
 *  3. Force authenticated-but-unonboarded users to /onboarding.
 *  4. Bounce signed-in users away from /login, /signup and /onboarding.
 *  5. Enforce role access (requester vs runner) and admin access.
 *  6. Send suspended users to /suspended.
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;
  const isDashboard =
    pathname.startsWith("/requester") || pathname.startsWith("/runner");
  const isAdmin = pathname.startsWith("/admin");
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isOnboarding = pathname === "/onboarding";
  const isProtected = isDashboard || isAdmin || isOnboarding;

  // --- Unauthenticated ------------------------------------------------------
  if (!session) {
    if (isProtected) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return res;
  }

  // --- Authenticated: only fetch the profile when the path needs it ---------
  if (!isProtected && !isAuthPage) {
    return res;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed, is_admin, is_suspended")
    .eq("id", session.user.id)
    .single();

  // Suspended users are locked out of everything but the notice page.
  if (profile?.is_suspended) {
    return NextResponse.redirect(new URL("/suspended", req.url));
  }

  // --- Admin area -----------------------------------------------------------
  if (isAdmin) {
    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL("/requester", req.url));
    }
    return res;
  }

  const onboarded = profile?.onboarding_completed ?? false;
  const role = (profile?.role ?? "requester") as UserRole;

  // Must finish onboarding before reaching any dashboard.
  if (!onboarded) {
    return isOnboarding
      ? res
      : NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Onboarded users have no reason to see auth screens or onboarding again.
  if (isAuthPage || isOnboarding) {
    return NextResponse.redirect(new URL(dashboardForRole(role), req.url));
  }

  // Role-based access control on the dashboards.
  if (role !== "both") {
    if (pathname.startsWith("/runner") && role === "requester") {
      return NextResponse.redirect(new URL("/requester", req.url));
    }
    if (pathname.startsWith("/requester") && role === "runner") {
      return NextResponse.redirect(new URL("/runner", req.url));
    }
  }

  return res;
}

export const config = {
  // Run on app routes, skipping Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
