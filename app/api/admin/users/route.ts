import { NextResponse, type NextRequest } from "next/server";

import { adminDb, requireAdmin } from "@/lib/admin";
import { createRouteClient } from "@/lib/supabase-server";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/** GET /api/admin/users — searchable, paginated user list with order counts. */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(createRouteClient()))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const page = Math.max(0, Number(searchParams.get("page") ?? 0));

  const db = adminDb();
  let query = db
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  // Sanitise: strip characters that have meaning in a PostgREST `.or()` filter
  // string so user input can't inject extra filter conditions.
  const safeQ = q?.replace(/[,()*:."'\\%]/g, " ").trim();
  if (safeQ) {
    query = query.or(`full_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profiles = (data as Profile[] | null) ?? [];

  // Order counts for this page of users, in one query.
  const ids = profiles.map((p) => p.id);
  const orderCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: orderRows } = await db
      .from("orders")
      .select("requester_id")
      .in("requester_id", ids);
    for (const row of orderRows ?? []) {
      const rid = (row as { requester_id: string }).requester_id;
      orderCounts.set(rid, (orderCounts.get(rid) ?? 0) + 1);
    }
  }

  const users = profiles.map((p) => ({
    ...p,
    order_count: orderCounts.get(p.id) ?? 0,
  }));

  return NextResponse.json({
    users,
    hasMore: profiles.length === PAGE_SIZE,
  });
}
