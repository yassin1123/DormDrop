import { NextResponse, type NextRequest } from "next/server";

import { adminDb, requireAdmin } from "@/lib/admin";
import { ORDER_SELECT } from "@/lib/order-select";
import { createRouteClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/** GET /api/admin/orders — filtered, paginated order list (admin only). */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(createRouteClient()))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const zone = searchParams.get("zone");
  const q = searchParams.get("q")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(0, Number(searchParams.get("page") ?? 0));

  let query = adminDb()
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (status && status !== "all") query = query.eq("status", status);
  if (zone && zone !== "all") query = query.eq("delivery_zone", zone);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);
  if (q) query = query.ilike("delivery_address", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    orders: data ?? [],
    hasMore: (data?.length ?? 0) === PAGE_SIZE,
  });
}
