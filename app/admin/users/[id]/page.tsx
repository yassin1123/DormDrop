import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck } from "lucide-react";

import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { MetricCard, Panel } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { adminDb } from "@/lib/admin";
import { ROLE_LABELS } from "@/lib/constants";
import { formatCurrency, formatDateTime, getInitials } from "@/lib/utils";
import type { OrderStatus, Profile } from "@/types";

export const dynamic = "force-dynamic";

interface OrderRow {
  id: string;
  status: OrderStatus;
  total: number;
  delivery_fee: number;
  created_at: string;
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const db = adminDb();

  const { data: profileRaw } = await db
    .from("profiles")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!profileRaw) notFound();
  const profile = profileRaw as Profile;

  const isRunner = profile.role === "runner" || profile.role === "both";

  const [{ data: requesterOrders }, { data: deliveredCount }] =
    await Promise.all([
      db
        .from("orders")
        .select("id, status, total, delivery_fee, created_at")
        .eq("requester_id", params.id)
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("orders")
        .select("total")
        .eq("requester_id", params.id)
        .eq("status", "delivered"),
    ]);

  const orders = (requesterOrders as OrderRow[] | null) ?? [];
  const spent = ((deliveredCount as { total: number }[] | null) ?? []).reduce(
    (s, o) => s + Number(o.total),
    0,
  );

  return (
    <div>
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      {/* Identity */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white">
            {getInitials(profile.full_name || "DD")}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {profile.full_name || "—"}
            </h1>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              {profile.email ?? "—"}
              {profile.is_verified && (
                <BadgeCheck className="h-4 w-4 text-emerald-500" />
              )}
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                {ROLE_LABELS[profile.role]}
              </span>
              <span>{profile.delivery_zone ?? "No zone"}</span>
              <span>· Joined {formatDateTime(profile.created_at)}</span>
              {profile.is_suspended && (
                <span className="rounded bg-red-100 px-2 py-0.5 font-semibold text-red-700">
                  Suspended
                </span>
              )}
            </p>
          </div>
        </div>
        <AdminUserActions id={profile.id} isSuspended={profile.is_suspended} />
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Orders placed" value={String(orders.length)} />
        <MetricCard label="Total spent" value={formatCurrency(spent)} />
        {isRunner && (
          <>
            <MetricCard
              label="Deliveries"
              value={String(profile.total_deliveries)}
            />
            <MetricCard
              label="Earned"
              value={formatCurrency(profile.total_earnings)}
              hint={
                profile.runner_rating != null
                  ? `${profile.runner_rating.toFixed(1)}★ rating`
                  : "No rating yet"
              }
            />
          </>
        )}
      </div>

      {/* Order history */}
      <div className="mt-6">
        <Panel title="Order history (as requester)">
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No orders yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        #{o.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2.5">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {formatCurrency(o.total)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {formatDateTime(o.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
