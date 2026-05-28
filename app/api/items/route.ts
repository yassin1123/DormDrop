import { NextResponse, type NextRequest } from "next/server";

import { ITEM_CATEGORIES } from "@/lib/constants";
import { createRouteClient } from "@/lib/supabase-server";
import type { ItemCategory } from "@/types";

// Uses the request's cookies + query params — always run per request.
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set(ITEM_CATEGORIES.map((c) => c.value));

/**
 * GET /api/items — the catalogue. Optional query params:
 *   ?category=snacks   filter to a single category
 *   ?in_stock=true     only in-stock items (default: all)
 */
export async function GET(request: NextRequest) {
  const supabase = createRouteClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from("items")
    .select("*")
    .eq("is_deleted", false)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const category = searchParams.get("category");
  if (category) {
    if (!VALID_CATEGORIES.has(category as ItemCategory)) {
      return NextResponse.json(
        { error: "Unknown category." },
        { status: 400 },
      );
    }
    query = query.eq("category", category);
  }

  if (searchParams.get("in_stock") === "true") {
    query = query.eq("in_stock", true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data });
}
