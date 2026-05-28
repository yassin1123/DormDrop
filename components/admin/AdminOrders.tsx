"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { useToast } from "@/components/feedback/ToastProvider";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PageTitle, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { DELIVERY_ZONES, ORDER_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { OrderStatus, OrderWithDetails } from "@/types";

const STATUS_KEYS = Object.keys(ORDER_STATUSES) as OrderStatus[];
const STATUS_FILTER = [
  { value: "all", label: "All statuses" },
  ...STATUS_KEYS.map((s) => ({ value: s, label: ORDER_STATUSES[s].label })),
];
const ZONE_FILTER = [
  { value: "all", label: "All zones" },
  ...DELIVERY_ZONES.map((z) => ({ value: z, label: z })),
];

export function AdminOrders() {
  const toast = useToast();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [status, setStatus] = useState("all");
  const [zone, setZone] = useState("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(0);

  const [selected, setSelected] = useState<OrderWithDetails | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>("pending");
  const [saving, setSaving] = useState(false);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      const page = reset ? 0 : pageRef.current;
      const params = new URLSearchParams({ page: String(page) });
      if (status !== "all") params.set("status", status);
      if (zone !== "all") params.set("zone", zone);
      if (q.trim()) params.set("q", q.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      const rows = (data.orders as OrderWithDetails[]) ?? [];
      setHasMore(Boolean(data.hasMore));
      pageRef.current = page + 1;
      setOrders((prev) => (reset ? rows : [...prev, ...rows]));
    },
    [status, zone, q, from, to],
  );

  // Debounced re-query on any filter change.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      void fetchPage(true).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    await fetchPage(false);
    setLoadingMore(false);
  }

  function manage(order: OrderWithDetails) {
    setSelected(order);
    setNewStatus(order.status);
  }

  async function applyStatus(target?: OrderStatus) {
    if (!selected) return;
    const next = target ?? newStatus;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      const updated = data.order as OrderWithDetails;
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setSelected(null);
      toast.success(`Order updated to “${ORDER_STATUSES[next].label}”.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageTitle title="Orders" subtitle="Search, filter and manage every order." />

      {/* Filters */}
      <Panel className="mb-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUS_FILTER}
          />
          <Select
            label="Zone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            options={ZONE_FILTER}
          />
          <Input
            label="Search address"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Block 3…"
          />
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </Panel>

      {/* Table */}
      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : orders.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            No orders match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Zone</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Placed</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      #{o.id.slice(0, 8)}
                      <span className="block text-xs font-normal text-slate-400">
                        {o.order_items.length} lines
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {o.delivery_zone}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {formatCurrency(o.total)}
                    </td>
                    <td className="px-3 py-2.5">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {formatDateTime(o.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => manage(o)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && !loading && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" isLoading={loadingMore} onClick={loadMore}>
              Load more
            </Button>
          </div>
        )}
      </Panel>

      {/* Manage modal */}
      <Modal
        open={selected !== null}
        onClose={() => (saving ? undefined : setSelected(null))}
        title={selected ? `Order #${selected.id.slice(0, 8)}` : ""}
        description="Full detail and admin controls."
        footer={
          <>
            <Button
              variant="danger"
              isLoading={saving}
              onClick={() => applyStatus("cancelled")}
              disabled={selected?.status === "cancelled"}
            >
              Cancel &amp; refund
            </Button>
            <Button isLoading={saving} onClick={() => applyStatus()}>
              Update status
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-800">
                {selected.delivery_zone}
              </p>
              <p className="text-slate-600">{selected.delivery_address}</p>
              {selected.delivery_notes && (
                <p className="mt-1 text-slate-400">“{selected.delivery_notes}”</p>
              )}
            </div>

            <ul className="space-y-1 text-sm">
              {selected.order_items.map((li) => (
                <li key={li.id} className="flex justify-between text-slate-600">
                  <span>
                    {li.quantity}× {li.item.name}
                  </span>
                  <span>{formatCurrency(li.price_at_time * li.quantity)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(selected.total)}</span>
              </li>
            </ul>

            <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
              <p>
                <span className="text-slate-400">Requester:</span>{" "}
                {selected.requester?.full_name ?? "—"}
              </p>
              <p>
                <span className="text-slate-400">Runner:</span>{" "}
                {selected.runner?.full_name ?? "Unassigned"}
              </p>
            </div>

            <Select
              label="Set status (support override)"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
              options={STATUS_KEYS.map((s) => ({
                value: s,
                label: ORDER_STATUSES[s].label,
              }))}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
