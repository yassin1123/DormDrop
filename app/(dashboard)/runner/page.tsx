import { redirect } from "next/navigation";

import { RunnerDashboard } from "@/components/runner/RunnerDashboard";
import { ORDER_SELECT } from "@/lib/order-select";
import { createServerClient } from "@/lib/supabase-server";
import { roundMoney } from "@/lib/utils";
import type { OrderWithDetails, Profile } from "@/types";

export const metadata = { title: "Deliver" };

export const dynamic = "force-dynamic";

export default async function RunnerPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  // The live open-orders feed is fetched client-side by useAvailableOrders;
  // here we just load what's needed for the static parts of the dashboard.
  const [{ data: active }, { data: deliveredWeek }, { data: payouts }] =
    await Promise.all([
      // This runner's in-progress deliveries.
      supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("runner_id", user.id)
        .in("status", ["accepted", "picking_up", "on_the_way"])
        .order("created_at", { ascending: false }),
      // Delivered in the last 7 days → today's + this week's earnings.
      supabase
        .from("orders")
        .select("delivery_fee, delivered_at")
        .eq("runner_id", user.id)
        .eq("status", "delivered")
        .gte("delivered_at", startOfWeek.toISOString()),
      // Pending payouts → amount owed.
      supabase
        .from("payouts")
        .select("amount")
        .eq("runner_id", user.id)
        .eq("status", "pending"),
    ]);

  const deliveredRows =
    (deliveredWeek as { delivery_fee: number; delivered_at: string }[] | null) ??
    [];
  const todayIso = startOfToday.toISOString();
  const todaysEarnings = deliveredRows
    .filter((o) => o.delivered_at >= todayIso)
    .reduce((sum, o) => sum + Number(o.delivery_fee), 0);
  const weekEarnings = deliveredRows.reduce(
    (sum, o) => sum + Number(o.delivery_fee),
    0,
  );
  const pendingPayout = (payouts ?? []).reduce(
    (sum, p) => sum + Number((p as { amount: number }).amount),
    0,
  );

  // Per-day earnings for the last 7 days (oldest → today), for the chart.
  const dayMs = 86_400_000;
  const weekData = Array.from({ length: 7 }).map((_, i) => {
    const dayStart = new Date(startOfWeek.getTime() + i * dayMs);
    const dayEnd = new Date(dayStart.getTime() + dayMs);
    const amount = deliveredRows
      .filter((o) => {
        const t = new Date(o.delivered_at).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      })
      .reduce((sum, o) => sum + Number(o.delivery_fee), 0);
    return {
      label: dayStart.toLocaleDateString("en-GB", { weekday: "short" }),
      amount: roundMoney(amount),
    };
  });
  const weekDeliveries = deliveredRows.length;

  return (
    <RunnerDashboard
      profile={profile as Profile}
      activeDeliveries={(active as unknown as OrderWithDetails[]) ?? []}
      todaysEarnings={todaysEarnings}
      weekEarnings={weekEarnings}
      pendingPayout={pendingPayout}
      weekData={weekData}
      weekDeliveries={weekDeliveries}
    />
  );
}
