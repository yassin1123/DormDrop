import { NextResponse } from "next/server";

import { createRouteClient } from "@/lib/supabase-server";

// Depends on the auth cookie — always run per request.
export const dynamic = "force-dynamic";

/**
 * GET /api/reviews/pending — the most recent delivered order the signed-in
 * requester hasn't reviewed yet (so we can prompt them to rate). Returns
 * `{ order: null }` when there's nothing to rate.
 */
export async function GET() {
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Recent delivered orders by this requester that have a runner to review.
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, runner_id, delivered_at, runner:profiles!orders_runner_id_fkey ( id, full_name )",
    )
    .eq("requester_id", user.id)
    .eq("status", "delivered")
    .not("runner_id", "is", null)
    .order("delivered_at", { ascending: false })
    .limit(20);

  if (!orders || orders.length === 0) {
    return NextResponse.json({ order: null });
  }

  // Which of those have I already reviewed?
  const { data: reviews } = await supabase
    .from("reviews")
    .select("order_id")
    .eq("reviewer_id", user.id);

  const reviewed = new Set((reviews ?? []).map((r) => r.order_id as string));
  const pending = orders.find((o) => !reviewed.has(o.id));

  return NextResponse.json({ order: pending ?? null });
}
