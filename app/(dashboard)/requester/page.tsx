import { redirect } from "next/navigation";

import { RequesterDashboard } from "@/components/orders/RequesterDashboard";
import { ORDER_SELECT } from "@/lib/order-select";
import { createServerClient } from "@/lib/supabase-server";
import type { Item, OrderWithDetails, Profile } from "@/types";

export const metadata = { title: "Order" };

// Always render fresh — orders change in real time.
export const dynamic = "force-dynamic";

export default async function RequesterPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: items }, { data: orders }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("items")
        .select("*")
        .eq("in_stock", true)
        .eq("is_deleted", false)
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  if (!profile) redirect("/login");

  return (
    <RequesterDashboard
      profile={profile as Profile}
      items={(items as Item[]) ?? []}
      initialOrders={(orders as unknown as OrderWithDetails[]) ?? []}
    />
  );
}
