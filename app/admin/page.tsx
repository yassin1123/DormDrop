import { Clock, Radio, ShoppingCart, Wallet } from "lucide-react";

import {
  BusiestHoursChart,
  OrdersBarChart,
  PopularItemsChart,
  RevenueLineChart,
} from "@/components/admin/Charts";
import { MetricCard, PageTitle, Panel } from "@/components/admin/ui";
import { adminDb } from "@/lib/admin";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface RecentOrder {
  id: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  platform_fee: number;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default async function AdminDashboardPage() {
  const db = adminDb();

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const sevenStart = new Date(startToday);
  sevenStart.setDate(sevenStart.getDate() - 6);

  const [{ data: recentRaw }, { data: itemsRaw }, { count: activeRunners }] =
    await Promise.all([
      db
        .from("orders")
        .select("id, status, created_at, accepted_at, delivered_at, platform_fee")
        .gte("created_at", sevenStart.toISOString()),
      db.from("order_items").select("quantity, item:items ( name )").limit(5000),
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .in("role", ["runner", "both"])
        .eq("is_online", true)
        .eq("is_suspended", false),
    ]);

  const recent = (recentRaw as RecentOrder[] | null) ?? [];
  const real = recent.filter((o) => o.status !== "awaiting_payment");

  // --- Today's metrics ------------------------------------------------------
  const ordersToday = real.filter(
    (o) => new Date(o.created_at) >= startToday,
  ).length;

  const deliveredToday = recent.filter(
    (o) =>
      o.status === "delivered" &&
      o.delivered_at &&
      new Date(o.delivered_at) >= startToday,
  );
  const revenueToday = deliveredToday.reduce(
    (s, o) => s + Number(o.platform_fee),
    0,
  );

  const deliveryTimes = deliveredToday
    .filter((o) => o.accepted_at && o.delivered_at)
    .map(
      (o) =>
        (new Date(o.delivered_at as string).getTime() -
          new Date(o.accepted_at as string).getTime()) /
        60000,
    );
  const avgDeliveryMin =
    deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
      : null;

  // --- 7-day buckets --------------------------------------------------------
  const days: { key: string; day: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenStart);
    d.setDate(d.getDate() + i);
    days.push({
      key: dayKey(d),
      day: d.toLocaleDateString("en-GB", { weekday: "short" }),
    });
  }

  const ordersByDay = new Map<string, number>();
  const revenueByDay = new Map<string, number>();
  for (const o of real) {
    const k = dayKey(new Date(o.created_at));
    ordersByDay.set(k, (ordersByDay.get(k) ?? 0) + 1);
  }
  for (const o of recent) {
    if (o.status === "delivered" && o.delivered_at) {
      const k = dayKey(new Date(o.delivered_at));
      revenueByDay.set(k, (revenueByDay.get(k) ?? 0) + Number(o.platform_fee));
    }
  }

  const ordersChart = days.map((d) => ({
    day: d.day,
    orders: ordersByDay.get(d.key) ?? 0,
  }));
  const revenueChart = days.map((d) => ({
    day: d.day,
    revenue: Number((revenueByDay.get(d.key) ?? 0).toFixed(2)),
  }));

  // --- Busiest hours (last 7 days) -----------------------------------------
  const byHour = new Array(24).fill(0);
  for (const o of real) {
    byHour[new Date(o.created_at).getHours()] += 1;
  }
  const hoursChart = byHour.map((orders, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    orders,
  }));

  // --- Popular items --------------------------------------------------------
  const itemRows =
    (itemsRaw as { quantity: number; item: { name: string } | null }[] | null) ??
    [];
  const itemTotals = new Map<string, number>();
  for (const row of itemRows) {
    const name = row.item?.name;
    if (!name) continue;
    itemTotals.set(name, (itemTotals.get(name) ?? 0) + row.quantity);
  }
  const popularItems = [...itemTotals.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  return (
    <div>
      <PageTitle
        title="Dashboard"
        subtitle="Platform health at a glance — today and the last 7 days."
      />

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Orders today"
          value={String(ordersToday)}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <MetricCard
          label="Revenue today"
          value={formatCurrency(revenueToday)}
          hint="Platform fees on delivered orders"
          icon={<Wallet className="h-4 w-4" />}
        />
        <MetricCard
          label="Active runners"
          value={String(activeRunners ?? 0)}
          hint="Online right now"
          icon={<Radio className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg delivery time"
          value={avgDeliveryMin != null ? `${avgDeliveryMin} min` : "—"}
          hint="Accepted → delivered, today"
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Orders · last 7 days">
          <OrdersBarChart data={ordersChart} />
        </Panel>
        <Panel title="Revenue · last 7 days">
          <RevenueLineChart data={revenueChart} />
        </Panel>
        <Panel title="Busiest hours · last 7 days">
          <BusiestHoursChart data={hoursChart} />
        </Panel>
        <Panel title="Most popular items">
          <PopularItemsChart data={popularItems} />
        </Panel>
      </div>
    </div>
  );
}
