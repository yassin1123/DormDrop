import { NextResponse, type NextRequest } from "next/server";

import { adminDb, requireAdmin } from "@/lib/admin";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { createRouteClient } from "@/lib/supabase-server";
import type { ItemCategory } from "@/types";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(ITEM_CATEGORIES.map((c) => c.value));

/** GET /api/admin/items — all live (non-deleted) catalogue items. */
export async function GET() {
  if (!(await requireAdmin(createRouteClient()))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await adminDb()
    .from("items")
    .select("*")
    .eq("is_deleted", false)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

interface ItemInput {
  name?: string;
  description?: string | null;
  price?: number;
  category?: ItemCategory;
  image_url?: string | null;
  in_stock?: boolean;
}

/** POST /api/admin/items — create a catalogue item. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin(createRouteClient()))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ItemInput;
  try {
    body = (await request.json()) as ItemInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const price = Number(body.price);
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "A valid price is required." }, {
      status: 400,
    });
  }
  if (!body.category || !CATEGORIES.has(body.category)) {
    return NextResponse.json({ error: "A valid category is required." }, {
      status: 400,
    });
  }

  const { data, error } = await adminDb()
    .from("items")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      price,
      category: body.category,
      image_url: body.image_url?.trim() || null,
      in_stock: body.in_stock ?? true,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data }, { status: 201 });
}
