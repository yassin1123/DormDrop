import { NextResponse, type NextRequest } from "next/server";

import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { createRouteClient } from "@/lib/supabase-server";

// Depends on the auth cookie — always run per request.
export const dynamic = "force-dynamic";

interface CreateReviewInput {
  order_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string | null;
}

/**
 * POST /api/reviews — leave a review for the other party on a delivered order.
 *
 * RLS enforces that the reviewer took part in the order and it's delivered.
 * The `handle_new_review` trigger recomputes the reviewee's average rating and
 * notifies them — no app-side bookkeeping needed.
 */
export async function POST(request: NextRequest) {
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`reviews:${user.id}`, 15);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  let body: CreateReviewInput;
  try {
    body = (await request.json()) as CreateReviewInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rating = Math.floor(Number(body.rating));
  if (!body.order_id || !body.reviewee_id) {
    return NextResponse.json(
      { error: "order_id and reviewee_id are required." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be an integer from 1 to 5." },
      { status: 400 },
    );
  }

  const { data: review, error } = await supabase
    .from("reviews")
    .insert({
      order_id: body.order_id,
      reviewer_id: user.id,
      reviewee_id: body.reviewee_id,
      rating,
      comment: body.comment?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    // 23505 = unique_violation (already reviewed this order).
    const isDuplicate = error.code === "23505";
    return NextResponse.json(
      {
        error: isDuplicate
          ? "You've already reviewed this order."
          : error.message,
      },
      { status: isDuplicate ? 409 : 400 },
    );
  }

  return NextResponse.json({ review }, { status: 201 });
}
