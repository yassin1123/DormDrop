import { NextResponse, type NextRequest } from "next/server";

import { adminDb, requireAdmin } from "@/lib/admin";
import { createRouteClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/users/:id — suspend / unsuspend a user. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await requireAdmin(createRouteClient()))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { is_suspended?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.is_suspended !== "boolean") {
    return NextResponse.json(
      { error: "is_suspended (boolean) is required." },
      { status: 400 },
    );
  }

  const db = adminDb();
  const update: Record<string, unknown> = { is_suspended: body.is_suspended };
  // Suspending also takes them offline immediately.
  if (body.is_suspended) update.is_online = false;

  const { data, error } = await db
    .from("profiles")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ user: data });
}
