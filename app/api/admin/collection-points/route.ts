import { NextResponse, type NextRequest } from "next/server";

import { adminDb, requireAdmin } from "@/lib/admin";
import { createRouteClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** GET /api/admin/collection-points — all collection points (active + not). */
export async function GET() {
  if (!(await requireAdmin(createRouteClient()))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await adminDb()
    .from("collection_points")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ points: data ?? [] });
}

interface PointInput {
  name?: string;
  address?: string;
  lat?: number | string;
  lng?: number | string;
  opening_hours?: string | null;
  is_active?: boolean;
}

/** POST /api/admin/collection-points — create a collection point. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin(createRouteClient()))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PointInput;
  try {
    body = (await request.json()) as PointInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!body.address?.trim()) {
    return NextResponse.json({ error: "Address is required." }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Valid coordinates are required." },
      { status: 400 },
    );
  }

  const { data, error } = await adminDb()
    .from("collection_points")
    .insert({
      name: body.name.trim(),
      address: body.address.trim(),
      lat,
      lng,
      opening_hours: body.opening_hours?.trim() || null,
      is_active: body.is_active ?? true,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ point: data }, { status: 201 });
}
