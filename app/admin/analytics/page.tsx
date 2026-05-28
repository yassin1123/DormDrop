import { Star } from "lucide-react";

import { MetricCard, PageTitle, Panel } from "@/components/admin/ui";
import { adminDb } from "@/lib/admin";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface OrderRow {
  status: string;
  delivery_zone: string;
  requester_id: string;
  total: number;
}
interface RunnerRow {
  id: string;
  full_name: string;
  total_deliveries: number;
  total_earnings: number;
  runner_rating: number | null;
}

export default async function AdminAnalyticsPage() {
  const db = adminDb();

  const [{ data: ordersRaw }, { data: runnersRaw }] = await Promise.all([
    db
      .from("orders")
      .select("status, delivery_zone, requester_id, total")
      .neq("status", "awaiting_payment")
      .limit(10000),
    db
      .from("profiles")
      .select("id, full_name, total_deliveries, total_earnings, runner_rating")
      .in("role", ["runner", "both"])
      .order("total_deliveries", { ascending: false })
      .limit(10),
  ]);

  const orders = (ordersRaw as OrderRow[] | null) ?? [];
  const runners = (runnersRaw as RunnerRow[] | null) ?? [];

  // --- Completion rate ------------------------------------------------------
  const total = orders.length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const completionRate = total ? Math.round((delivered / total) * 100) : 0;

  // --- Zones ----------------------------------------------------------------
  const zoneMap = new Map<string, number>();
  for (const o of orders) {
    zoneMap.set(o.delivery_zone, (zoneMap.get(o.delivery_zone) ?? 0) + 1);
  }
  const zones = [...zoneMap.entries()]
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count);
  const zoneMax = Math.max(1, ...zones.map((z) => z.count));

  // --- Requester aggregation ------------------------------------------------
  const reqMap = new Map<string, { orders: number; spent: number }>();
  for (const o of orders) {
    const r = reqMap.get(o.requester_id) ?? { orders: 0, spent: 0 };
    r.orders += 1;
    if (o.status === "delivered") r.spent += Number(o.total);
    reqMap.set(o.requester_id, r);
  }
  const reqEntries = [...reqMap.entries()];
  const topByOrders = [...reqEntries]
    .sort((a, b) => b[1].orders - a[1].orders)
    .slice(0, 5);
  const topBySpent = [...reqEntries]
    .sort((a, b) => b[1].spent - a[1].spent)
    .slice(0, 5);

  const reqIds = [
    ...new Set([...topByOrders, ...topBySpent].map(([id]) => id)),
  ];
  const nameMap = new Map<string, string>();
  if (reqIds.length > 0) {
    const { data: names } = await db
      .from("profiles")
      .select("id, full_name")
      .in("id", reqIds);
    for (const n of names ?? [])
      nameMap.set(n.id as string, (n.full_name as string) || "—");
  }

  return (
    <div>
      <PageTitle
        title="Analytics"
        subtitle="Zones, leaderboards and completion rate."
      />

      {/* Completion */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total orders" value={String(total)} />
        <MetricCard label="Delivered" value={String(delivered)} />
        <MetricCard label="Cancelled" value={String(cancelled)} />
        <MetricCard
          label="Completion rate"
          value={`${completionRate}%`}
          hint="Delivered ÷ all orders"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Zones */}
        <Panel title="Orders by delivery zone">
          {zones.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No data.</p>
          ) : (
            <ul className="space-y-2.5">
              {zones.map((z) => (
                <li key={z.zone}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{z.zone}</span>
                    <span className="font-medium text-slate-900">{z.count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(z.count / zoneMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Runner leaderboard */}
        <Panel title="Runner leaderboard">
          {runners.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No runners yet.
            </p>
          ) : (
            <ol className="space-y-1">
              {runners.map((r, i) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                >
                  <span className="w-5 text-center text-sm font-bold text-slate-400">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-900">
                    {r.full_name || "—"}
                  </span>
                  <span className="text-sm text-slate-500">
                    {r.total_deliveries} deliveries
                  </span>
                  <span className="w-16 text-right text-sm font-medium text-emerald-600">
                    {formatCurrency(r.total_earnings)}
                  </span>
                  <span className="flex w-10 items-center justify-end gap-0.5 text-xs text-slate-500">
                    {r.runner_rating != null ? (
                      <>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {r.runner_rating.toFixed(1)}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {/* Most frequent requesters */}
        <Panel title="Most frequent orderers">
          <LeaderList
            rows={topByOrders.map(([id, v]) => ({
              name: nameMap.get(id) ?? "—",
              value: `${v.orders} orders`,
            }))}
          />
        </Panel>

        {/* Highest spenders */}
        <Panel title="Highest spenders">
          <LeaderList
            rows={topBySpent.map(([id, v]) => ({
              name: nameMap.get(id) ?? "—",
              value: formatCurrency(v.spent),
            }))}
          />
        </Panel>
      </div>
    </div>
  );
}

function LeaderList({ rows }: { rows: { name: string; value: string }[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data.</p>;
  }
  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <li
          key={`${r.name}-${i}`}
          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
        >
          <span className="w-5 text-center text-sm font-bold text-slate-400">
            {i + 1}
          </span>
          <span className="flex-1 text-sm font-medium text-slate-900">
            {r.name}
          </span>
          <span className="text-sm font-medium text-slate-600">{r.value}</span>
        </li>
      ))}
    </ol>
  );
}
