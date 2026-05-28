"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bike,
  ChevronRight,
  LifeBuoy,
  LogOut,
  PackageCheck,
  Pencil,
  ShoppingBag,
  Star,
  Wallet,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StarRating } from "@/components/ui/StarRating";
import { DELIVERY_ZONES, ROLE_LABELS } from "@/lib/constants";
import { createBrowserClient } from "@/lib/supabase";
import {
  cn,
  formatCurrency,
  formatDateTime,
  getInitials,
} from "@/lib/utils";
import type { ReviewWithReviewer } from "@/types";

export function ProfileView() {
  const router = useRouter();
  const toast = useToast();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [zone, setZone] = useState("");
  const [saving, setSaving] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [reqStats, setReqStats] = useState<{ orders: number; spent: number } | null>(null);
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);

  const isRunner = profile?.role === "runner" || profile?.role === "both";
  const isRequester = profile?.role === "requester" || profile?.role === "both";
  const isBoth = profile?.role === "both";

  // Seed the edit form from the profile.
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setZone(profile.delivery_zone ?? DELIVERY_ZONES[0]);
    }
  }, [profile]);

  // Load role-specific stats / reviews.
  const loadStats = useCallback(async () => {
    if (!user || !profile) return;
    const supabase = createBrowserClient();

    if (isRequester) {
      const [{ count }, { data: delivered }] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("requester_id", user.id),
        supabase
          .from("orders")
          .select("total")
          .eq("requester_id", user.id)
          .eq("status", "delivered"),
      ]);
      const spent = (delivered ?? []).reduce(
        (s, o) => s + Number((o as { total: number }).total),
        0,
      );
      setReqStats({ orders: count ?? 0, spent });
    }

    if (isRunner) {
      const { data } = await supabase
        .from("reviews")
        .select(
          "*, reviewer:profiles!reviews_reviewer_id_fkey ( id, full_name, avatar_url )",
        )
        .eq("reviewee_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setReviews((data as unknown as ReviewWithReviewer[]) ?? []);
    }
  }, [user, profile, isRequester, isRunner]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  async function save() {
    if (!user) return;
    if (fullName.trim().length < 2) {
      toast.error("Please enter your name.");
      return;
    }
    setSaving(true);
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        delivery_zone: zone,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    setEditing(false);
    toast.success("Profile updated.");
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  async function deleteAccount() {
    if (!user) return;
    setDeleting(true);
    const supabase = createBrowserClient();
    await supabase
      .from("profiles")
      .update({ is_active: false, is_online: false })
      .eq("id", user.id);
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Identity */}
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-900 font-display text-xl font-bold text-white">
          {getInitials(profile.full_name || "DD")}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-stone-900">
            {profile.full_name || "Your account"}
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-stone-500">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              {ROLE_LABELS[profile.role]}
            </span>
            {profile.is_verified && (
              <span className="inline-flex items-center gap-0.5 text-emerald-600">
                <BadgeCheck className="h-4 w-4" /> Verified
              </span>
            )}
          </p>
        </div>
        {!editing && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Pencil className="h-4 w-4" />}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        )}
      </div>

      {/* Account details / edit form */}
      <Card>
        <CardContent className={editing ? "space-y-4 p-5" : "divide-y divide-stone-100 p-0"}>
          {editing ? (
            <>
              <Input
                label="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                label="Phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07700 900000"
              />
              <Select
                label="Delivery zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                options={DELIVERY_ZONES.map((z) => ({ value: z, label: z }))}
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditing(false);
                    setFullName(profile.full_name ?? "");
                    setPhone(profile.phone ?? "");
                    setZone(profile.delivery_zone ?? DELIVERY_ZONES[0]);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button className="flex-1" isLoading={saving} onClick={save}>
                  Save
                </Button>
              </div>
            </>
          ) : (
            <>
              <DetailRow label="Email" value={user?.email ?? "—"} />
              <DetailRow label="Phone" value={profile.phone || "Not set"} />
              <DetailRow
                label="Delivery zone"
                value={profile.delivery_zone ?? "Not set"}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Requester stats */}
      {isRequester && (
        <div className="grid grid-cols-2 gap-3">
          <Stat
            icon={<ShoppingBag className="h-4 w-4" />}
            label="Orders placed"
            value={reqStats ? String(reqStats.orders) : "—"}
          />
          <Stat
            icon={<Wallet className="h-4 w-4" />}
            label="Total spent"
            value={reqStats ? formatCurrency(reqStats.spent) : "—"}
            highlight
          />
        </div>
      )}

      {/* Runner stats */}
      {isRunner && (
        <div className="grid grid-cols-3 gap-3">
          <Stat
            icon={<Wallet className="h-4 w-4" />}
            label="Earned"
            value={formatCurrency(profile.total_earnings)}
            highlight
          />
          <Stat
            icon={<PackageCheck className="h-4 w-4" />}
            label="Deliveries"
            value={String(profile.total_deliveries)}
          />
          <Stat
            icon={<Star className="h-4 w-4" />}
            label="Rating"
            value={
              profile.runner_rating != null
                ? profile.runner_rating.toFixed(1)
                : "—"
            }
          />
        </div>
      )}

      {/* Links */}
      <div className="space-y-2">
        <Link
          href={isRunner && !isBoth ? "/runner/history" : "/requester/orders"}
          className="press flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-soft"
        >
          <span className="font-medium text-stone-800">
            {isRunner && !isBoth ? "Delivery history" : "Order history"}
          </span>
          <ChevronRight className="h-5 w-5 text-stone-400" />
        </Link>
        <Link
          href="/help"
          className="press flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-soft"
        >
          <span className="flex items-center gap-2 font-medium text-stone-800">
            <LifeBuoy className="h-4 w-4 text-stone-400" /> Help &amp; support
          </span>
          <ChevronRight className="h-5 w-5 text-stone-400" />
        </Link>
      </div>

      {/* Reviews received (runners) */}
      {isRunner && (
        <div>
          <h2 className="mb-2 font-display text-lg font-semibold text-stone-900">
            Reviews about you
          </h2>
          {reviews.length === 0 ? (
            <Card>
              <EmptyState
                emoji="⭐"
                title="No reviews yet"
                description="Complete a delivery to get your first review."
              />
            </Card>
          ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-800">
                      {r.reviewer?.full_name || "A student"}
                    </span>
                    <StarRating value={r.rating} size="sm" />
                  </div>
                  {r.comment && (
                    <p className="mt-1.5 text-sm text-stone-600">
                      “{r.comment}”
                    </p>
                  )}
                  <p className="mt-1 text-xs text-stone-400">
                    {formatDateTime(r.created_at)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Dual-role quick switch */}
      {isBoth && (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/requester">
            <Button
              variant="outline"
              className="w-full"
              leftIcon={<ShoppingBag className="h-4 w-4" />}
            >
              Order
            </Button>
          </Link>
          <Link href="/runner">
            <Button
              variant="outline"
              className="w-full"
              leftIcon={<Bike className="h-4 w-4" />}
            >
              Deliver
            </Button>
          </Link>
        </div>
      )}

      <div className="space-y-2 pt-2">
        <Button
          variant="ghost"
          className="w-full text-stone-600"
          isLoading={signingOut}
          onClick={handleSignOut}
          leftIcon={<LogOut className="h-4 w-4" />}
        >
          Sign out
        </Button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="w-full py-2 text-center text-sm font-medium text-red-500 hover:text-red-600"
        >
          Delete account
        </button>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => (deleting ? undefined : setDeleteOpen(false))}
        title="Delete your account?"
        description="Your profile will be deactivated and you'll be signed out. This can't be undone from the app."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Keep account
            </Button>
            <Button variant="danger" isLoading={deleting} onClick={deleteAccount}>
              Delete account
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-500">
          We&apos;re sorry to see you go. You can sign up again anytime.
        </p>
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <span className="text-sm text-stone-500">{label}</span>
      <span className="truncate text-sm font-medium text-stone-800">
        {value}
      </span>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        highlight
          ? "border-emerald-200 bg-emerald-50"
          : "border-stone-200 bg-white",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1 text-xs font-medium",
          highlight ? "text-emerald-700" : "text-stone-400",
        )}
      >
        {icon}
        {label}
      </span>
      <p
        className={cn(
          "mt-1 font-display text-lg font-bold",
          highlight ? "text-emerald-600" : "text-stone-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}
