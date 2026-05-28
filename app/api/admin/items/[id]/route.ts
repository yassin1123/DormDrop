import { NextResponse, type NextRequest } from "next/server";

import { adminDb, requireAdmin } from "@/lib/admin";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { createRouteClient } from "@/lib/supabase-server";
import type { ItemCategory } from "@/types";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(ITEM_CATEGORIES.map((c) => c.value));

/** PATCH /api/admin/items/:id — edit fields / toggle in_stock. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAdmin(createRouteClient()))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) {
      return NextResponse.json({ error: "Name can't be empty." }, {
        status: 400,
      });
    }
    update.name = body.name.trim();
  }
  if ("description" in body) {
    update.description = String(body.description ?? "").trim() || null;
  }
  if ("image_url" in body) {
    update.image_url = String(body.image_url ?? "").trim() || null;
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Invalid price." }, { status: 400 });
    }
    update.price = price;
  }
  if (body.category !== undefined) {
    if (!CATEGORIES.has(body.category as ItemCategory)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    update.category = body.category;
  }
  if (typeof body.in_stock === "boolean") update.in_stock = body.in_stock;

  if ("stock_quantity" in body) {
    if (body.stock_quantity === null || body.stock_quantity === "") {
      update.stock_quantity = null; // null = unlimited
    } else {
      const qty = Math.floor(Number(body.stock_quantity));
      if (!Number.isFinite(qty) || qty < 0) {
        return NextResponse.json(
          { error: "Invalid stock quantity." },
          { status: 400 },
        );
      }
      update.stock_quantity = qty;
      update.in_stock = qty > 0; // 0 → out of stock, >0 → available
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await adminDb()
    .from("items")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item: data });
}

/** DELETE /api/admin/items/:id — soft delete (keeps order history intact). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAdmin(createRouteClient()))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await adminDb()
    .from("items")
    .update({ is_deleted: true, in_stock: false })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
