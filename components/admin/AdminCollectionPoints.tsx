"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { useToast } from "@/components/feedback/ToastProvider";
import { PageTitle, Panel } from "@/components/admin/ui";
import { GoogleMap } from "@/components/map/GoogleMap";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SOUTHAMPTON_CENTER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CollectionPoint } from "@/types";

interface FormState {
  name: string;
  address: string;
  lat: string;
  lng: string;
  opening_hours: string;
}

const EMPTY: FormState = {
  name: "",
  address: "",
  lat: "",
  lng: "",
  opening_hours: "",
};

export function AdminCollectionPoints() {
  const toast = useToast();
  const [points, setPoints] = useState<CollectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionPoint | null>(null);

  async function load() {
    const res = await fetch("/api/admin/collection-points");
    const data = await res.json();
    setPoints((data.points as CollectionPoint[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const markers = useMemo(
    () =>
      points
        .filter((p) => p.is_active)
        .map((p) => ({
          lat: Number(p.lat),
          lng: Number(p.lng),
          label: p.name,
        })),
    [points],
  );
  const center = useMemo(
    () =>
      points.length
        ? { lat: Number(points[0].lat), lng: Number(points[0].lng) }
        : SOUTHAMPTON_CENTER,
    [points],
  );

  async function toggleActive(point: CollectionPoint) {
    setBusyId(point.id);
    try {
      const res = await fetch(`/api/admin/collection-points/${point.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !point.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPoints((prev) =>
        prev.map((p) => (p.id === point.id ? (data.point as CollectionPoint) : p)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageTitle
        title="Collection points"
        subtitle="The hubs runners pick orders up from."
        action={
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setAddOpen(true)}
          >
            Add point
          </Button>
        }
      />

      <Panel className="mb-6">
        <GoogleMap
          center={center}
          zoom={13}
          markers={markers}
          className="h-64 w-full overflow-hidden rounded-xl sm:h-80"
        />
      </Panel>

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : points.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            No collection points yet — add your first one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Address</th>
                  <th className="px-3 py-2 font-medium">Hours</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {points.map((point) => (
                  <tr key={point.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {point.name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {point.address}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {point.opening_hours ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          point.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600",
                        )}
                      >
                        {point.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(point)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          isLoading={busyId === point.id}
                          onClick={() => toggleActive(point)}
                        >
                          {point.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Add */}
      <PointFormModal
        open={addOpen}
        title="Add collection point"
        initial={EMPTY}
        onClose={() => setAddOpen(false)}
        onSubmit={async (form) => {
          const res = await fetch("/api/admin/collection-points", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setPoints((prev) => [...prev, data.point as CollectionPoint]);
          toast.success("Collection point added.");
        }}
      />

      {/* Edit */}
      <PointFormModal
        open={editing !== null}
        title="Edit collection point"
        initial={
          editing
            ? {
                name: editing.name,
                address: editing.address,
                lat: String(editing.lat),
                lng: String(editing.lng),
                opening_hours: editing.opening_hours ?? "",
              }
            : EMPTY
        }
        onClose={() => setEditing(null)}
        onSubmit={async (form) => {
          if (!editing) return;
          const res = await fetch(
            `/api/admin/collection-points/${editing.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(form),
            },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setPoints((prev) =>
            prev.map((p) =>
              p.id === editing.id ? (data.point as CollectionPoint) : p,
            ),
          );
          toast.success("Collection point updated.");
        }}
      />
    </div>
  );
}

function PointFormModal({
  open,
  title,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: FormState;
  onClose: () => void;
  onSubmit: (form: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.name.trim()) return setError("Name is required.");
    if (!form.address.trim()) return setError("Address is required.");
    if (!Number.isFinite(Number(form.lat)) || !Number.isFinite(Number(form.lng))) {
      return setError("Enter valid coordinates.");
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => (saving ? undefined : onClose())}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button isLoading={saving} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="DormDrop Hub — SUSU"
        />
        <Input
          label="Address"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Highfield Campus, University Road"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Latitude"
            type="number"
            step="0.000001"
            value={form.lat}
            onChange={(e) => set("lat", e.target.value)}
            placeholder="50.9354"
          />
          <Input
            label="Longitude"
            type="number"
            step="0.000001"
            value={form.lng}
            onChange={(e) => set("lng", e.target.value)}
            placeholder="-1.3964"
          />
        </div>
        <Input
          label="Opening hours (optional)"
          value={form.opening_hours}
          onChange={(e) => set("opening_hours", e.target.value)}
          placeholder="24/7"
        />
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
