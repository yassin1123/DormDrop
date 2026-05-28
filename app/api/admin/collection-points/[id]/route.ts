import { NextResponse, type NextRequest } from "next/server";

import { adminDb, requireAdmin } from "@/lib/admin";
import { createRouteClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/collection-points/:id — edit fields / toggle active. */
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
  if (typeof body.address === "string") {
    if (!body.address.trim()) {
      return NextResponse.json({ error: "Address can't be empty." }, {
        status: 400,
      });
    }
    update.address = body.address.trim();
  }
  if (body.lat !== undefined) {
    const lat = Number(body.lat);
    if (!Number.isFinite(lat)) {
      return NextResponse.json({ error: "Invalid latitude." }, { status: 400 });
    }
    update.lat = lat;
  }
  if (body.lng !== undefined) {
    const lng = Number(body.lng);
    if (!Number.isFinite(lng)) {
      return NextResponse.json({ error: "Invalid longitude." }, { status: 400 });
    }
    update.lng = lng;
  }
  if ("opening_hours" in body) {
    update.opening_hours = String(body.opening_hours ?? "").trim() || null;
  }
  if (typeof body.is_active === "boolean") update.is_active = body.is_active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await adminDb()
    .from("collection_points")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ point: data });
}
