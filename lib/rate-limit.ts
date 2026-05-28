import { NextResponse } from "next/server";

/**
 * Basic in-memory fixed-window rate limiter.
 *
 * NOTE: state lives in the module (per serverless instance), so this is a
 * best-effort deterrent against bursts/abuse from a single user — not a
 * distributed guarantee. For hard limits across instances, back it with
 * Upstash Redis (`@upstash/ratelimit`). Good enough as a first line of defence.
 */
interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();

  // Opportunistically prune expired entries so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k);
    }
  }

  const entry = buckets.get(key);
  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (entry.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfter: 0 };
}

/** 429 response with a Retry-After header. */
export function tooManyRequests(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests — slow down a moment." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
