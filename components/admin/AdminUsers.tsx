"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Star } from "lucide-react";

import { useToast } from "@/components/feedback/ToastProvider";
import { PageTitle, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { Profile } from "@/types";

type AdminUser = Profile & { order_count: number };

export function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pageRef = useRef(0);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      const page = reset ? 0 : pageRef.current;
      const params = new URLSearchParams({ page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      const rows = (data.users as AdminUser[]) ?? [];
      setHasMore(Boolean(data.hasMore));
      pageRef.current = page + 1;
      setUsers((prev) => (reset ? rows : [...prev, ...rows]));
    },
    [q],
  );

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      void fetchPage(true).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [fetchPage]);

  async function toggleSuspend(u: AdminUser) {
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_suspended: !u.is_suspended }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id ? { ...x, is_suspended: !u.is_suspended } : x,
        ),
      );
      toast.success(u.is_suspended ? "User unsuspended." : "User suspended.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageTitle title="Users" subtitle="Everyone on the platform." />

      <Panel className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25"
          />
        </div>
      </Panel>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            No users found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Zone</th>
                  <th className="px-3 py-2 font-medium">Joined</th>
                  <th className="px-3 py-2 font-medium">Orders</th>
                  <th className="px-3 py-2 font-medium">Rating</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="font-medium text-slate-900 hover:text-emerald-700"
                      >
                        {u.full_name || "—"}
                      </Link>
                      <span className="block text-xs text-slate-400">
                        {u.email ?? "—"}
                      </span>
                      {u.is_suspended && (
                        <span className="mt-0.5 inline-block rounded bg-red-100 px-1.5 text-[10px] font-semibold uppercase text-red-700">
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {ROLE_LABELS[u.role]}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {u.delivery_zone ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {formatDateTime(u.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {u.order_count}
                    </td>
                    <td className="px-3 py-2.5">
                      {u.runner_rating != null ? (
                        <span className="inline-flex items-center gap-0.5 text-slate-600">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {u.runner_rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/users/${u.id}`}>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant={u.is_suspended ? "outline" : "danger"}
                          isLoading={busyId === u.id}
                          onClick={() => toggleSuspend(u)}
                        >
                          {u.is_suspended ? "Unsuspend" : "Suspend"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && !loading && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" isLoading={loadingMore} onClick={() => void (async () => { setLoadingMore(true); await fetchPage(false); setLoadingMore(false); })()}>
              Load more
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
