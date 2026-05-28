import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware — deliberately thin and dependency-free.
 *
 * It must run in the Vercel Edge runtime, which has no Node globals. Creating a
 * Supabase client here pulls in Node-only code (realtime/ws) that crashes with
 * "ReferenceError: __dirname is not defined". So middleware only does a fast,
 * cookie-based auth gate; the *authoritative* checks (real token validation,
 * onboarding, role and admin/suspension guards) run in the server layouts and
 * route handlers (Node runtime), which already enforce them.
 *
 *  1. Block unauthenticated access to /requester, /runner, /admin, /onboarding.
 *
 * (It intentionally does NOT redirect signed-in users away from /login: cookie
 * presence isn't proof of a valid session, and doing so could loop against the
 * layout's real getUser() check. The login page routes to the right dashboard
 * after a successful sign-in anyway.)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected =
    pathname.startsWith("/requester") ||
    pathname.startsWith("/runner") ||
    pathname.startsWith("/admin") ||
    pathname === "/onboarding";

  // Detect a Supabase session straight from the cookies (no client → Edge-safe).
  // The auth cookie is `sb-<project-ref>-auth-token` (sometimes chunked .0/.1).
  const hasSession = req.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && c.value);

  if (!hasSession && isProtected) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on app routes, skipping Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
