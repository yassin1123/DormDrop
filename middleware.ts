import { createServerClient } from "@supabase/ssr";
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
 *
 * Uses `@supabase/ssr` (Edge-runtime safe). The old `auth-helpers`
 * `createMiddlewareClient` pulled in Node-only code and crashed the Vercel
 * Edge runtime with "ReferenceError: __dirname is not defined".
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (not getSession()) revalidates the token + refreshes the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Build a redirect that carries any refreshed auth cookies set on `res`.
  const redirectTo = (path: string) => {
    const r = NextResponse.redirect(new URL(path, req.url));
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  const { pathname } = req.nextUrl;
  const isDashboard =
    pathname.startsWith("/requester") || pathname.startsWith("/runner");
  const isAdmin = pathname.startsWith("/admin");
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isOnboarding = pathname === "/onboarding";
  const isProtected = isDashboard || isAdmin || isOnboarding;

  // --- Unauthenticated ------------------------------------------------------
  if (!user) {
    if (isProtected) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectedFrom", pathname);
      const r = NextResponse.redirect(loginUrl);
      res.cookies.getAll().forEach((c) => r.cookies.set(c));
      return r;
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
    .eq("id", user.id)
    .single();

  // Suspended users are locked out of everything but the notice page.
  if (profile?.is_suspended) {
    return redirectTo("/suspended");
  }

  // --- Admin area -----------------------------------------------------------
  if (isAdmin) {
    if (!profile?.is_admin) {
      return redirectTo("/requester");
    }
    return res;
  }

  const onboarded = profile?.onboarding_completed ?? false;
  const role = (profile?.role ?? "requester") as UserRole;

  // Must finish onboarding before reaching any dashboard.
  if (!onboarded) {
    return isOnboarding ? res : redirectTo("/onboarding");
  }

  // Onboarded users have no reason to see auth screens or onboarding again.
  if (isAuthPage || isOnboarding) {
    return redirectTo(dashboardForRole(role));
  }

  // Role-based access control on the dashboards.
  if (role !== "both") {
    if (pathname.startsWith("/runner") && role === "requester") {
      return redirectTo("/requester");
    }
    if (pathname.startsWith("/requester") && role === "runner") {
      return redirectTo("/runner");
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
