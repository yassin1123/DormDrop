"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { useToast } from "@/components/feedback/ToastProvider";
import { PageTitle, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ITEM_CATEGORIES } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import type { Item, ItemCategory } from "@/types";

interface FormState {
  name: string;
  description: string;
  price: string;
  category: ItemCategory;
  image_url: string;
}

const EMPTY: FormState = {
  name: "",
  description: "",
  price: "",
  category: "snacks",
  image_url: "",
};

const CATEGORY_OPTIONS = ITEM_CATEGORIES.map((c) => ({
  value: c.value,
  label: `${c.emoji} ${c.label}`,
}));

export function AdminItems() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);

  async function load() {
    const res = await fetch("/api/admin/items");
    const data = await res.json();
    setItems((data.items as Item[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleStock(item: Item) {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/admin/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ in_stock: !item.in_stock }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? (data.item as Item) : i)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function softDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      const res = await fetch(`/api/admin/items/${deleting.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setItems((prev) => prev.filter((i) => i.id !== deleting.id));
      toast.success("Item deleted.");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageTitle
        title="Items"
        subtitle="Manage the catalogue."
        action={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
            Add item
          </Button>
        }
      />

      <Panel>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            No items yet — add your first one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Stock</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const cat = ITEM_CATEGORIES.find((c) => c.value === item.category);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-900">
                          {item.name}
                        </span>
                        {item.description && (
                          <span className="block max-w-xs truncate text-xs text-slate-400">
                            {item.description}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {cat ? `${cat.emoji} ${cat.label}` : item.category}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="px-3 py-2.5">
                        <StockCell
                          item={item}
                          busy={busyId === item.id}
                          onToggle={() => toggleStock(item)}
                          onSaved={(i) =>
                            setItems((prev) =>
                              prev.map((x) => (x.id === i.id ? i : x)),
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => setDeleting(item)}
                            aria-label="Delete item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Add */}
      <ItemFormModal
        open={addOpen}
        title="Add item"
        initial={EMPTY}
        onClose={() => setAddOpen(false)}
        onSubmit={async (form) => {
          const res = await fetch("/api/admin/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, price: Number(form.price) }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setItems((prev) => [data.item as Item, ...prev]);
          toast.success("Item added.");
        }}
      />

      {/* Edit */}
      <ItemFormModal
        open={editing !== null}
        title="Edit item"
        initial={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? "",
                price: String(editing.price),
                category: editing.category,
                image_url: editing.image_url ?? "",
              }
            : EMPTY
        }
        onClose={() => setEditing(null)}
        onSubmit={async (form) => {
          if (!editing) return;
          const res = await fetch(`/api/admin/items/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, price: Number(form.price) }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setItems((prev) =>
            prev.map((i) => (i.id === editing.id ? (data.item as Item) : i)),
          );
          toast.success("Item updated.");
        }}
      />

      {/* Delete confirm */}
      <Modal
        open={deleting !== null}
        onClose={() => (busyId ? undefined : setDeleting(null))}
        title="Delete item?"
        description={deleting ? `“${deleting.name}” will be hidden from the catalogue.` : ""}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={busyId === deleting?.id}
              onClick={softDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          This is a soft delete — past orders keep this item for their records.
        </p>
      </Modal>
    </div>
  );
}

/** Inline stock editor: a number field (blank = unlimited) + the in/out toggle. */
function StockCell({
  item,
  busy,
  onToggle,
  onSaved,
}: {
  item: Item;
  busy: boolean;
  onToggle: () => void;
  onSaved: (item: Item) => void;
}) {
  const toast = useToast();
  const [val, setVal] = useState(
    item.stock_quantity == null ? "" : String(item.stock_quantity),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVal(item.stock_quantity == null ? "" : String(item.stock_quantity));
  }, [item.stock_quantity]);

  async function save() {
    const raw = val.trim();
    const next = raw === "" ? null : Math.max(0, Math.floor(Number(raw)));
    if (raw !== "" && !Number.isFinite(Number(raw))) {
      setVal(item.stock_quantity == null ? "" : String(item.stock_quantity));
      return;
    }
    if (next === (item.stock_quantity ?? null)) return; // unchanged
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_quantity: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.item as Item);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
      setVal(item.stock_quantity == null ? "" : String(item.stock_quantity));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={val}
        placeholder="∞"
        disabled={saving}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        title="Stock quantity — leave blank for unlimited"
        className="h-8 w-16 rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
      />
      <button
        type="button"
        disabled={busy}
        onClick={onToggle}
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
          item.in_stock
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-slate-200 text-slate-600 hover:bg-slate-300",
        )}
      >
        {item.in_stock ? "In stock" : "Out"}
      </button>
    </div>
  );
}

function ItemFormModal({
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

  // Re-seed when the modal (re)opens with new initial values.
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
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid price.");
      return;
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
        />
        <Textarea
          label="Description"
          rows={2}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Price (£)"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
          />
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => set("category", e.target.value as ItemCategory)}
            options={CATEGORY_OPTIONS}
          />
        </div>
        <Input
          label="Image URL (optional)"
          value={form.image_url}
          onChange={(e) => set("image_url", e.target.value)}
          placeholder="https://…"
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
