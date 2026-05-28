"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bike,
  CheckCheck,
  PackageCheck,
  ShoppingBag,
  Star,
  X,
  XCircle,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { useAuth } from "@/components/auth/AuthProvider";
import { useWebNotifications } from "@/hooks/useWebNotifications";
import { createBrowserClient } from "@/lib/supabase";
import { cn, timeAgo } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types";

const BANNER_KEY = "dormdrop:notif-banner-dismissed";

const ICONS: Record<
  NotificationType,
  React.ComponentType<{ className?: string }>
> = {
  order_accepted: Bike,
  order_picked_up: ShoppingBag,
  order_delivered: PackageCheck,
  order_cancelled: XCircle,
  new_review: Star,
  new_order_nearby: Bike,
};

/** Where tapping a notification takes you. */
function hrefFor(n: Notification): string {
  switch (n.type) {
    case "order_accepted":
    case "order_picked_up":
    case "order_delivered":
      return n.order_id ? `/requester/orders/${n.order_id}` : "/requester/orders";
    case "new_order_nearby":
    case "order_cancelled":
      return "/runner";
    case "new_review":
      return "/profile";
    default:
      return "/";
  }
}

export function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const clientRef = useRef<SupabaseClient | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const { permission, supported, requestPermission, notify } =
    useWebNotifications();

  const unread = items.filter((n) => !n.is_read).length;

  useEffect(() => {
    setMounted(true);
    try {
      setBannerDismissed(localStorage.getItem(BANNER_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function dismissBanner() {
    setBannerDismissed(true);
    try {
      localStorage.setItem(BANNER_KEY, "1");
    } catch {
      // ignore
    }
  }

  const refresh = useCallback(async () => {
    if (!user) return;
    const supabase = clientRef.current ?? createBrowserClient();
    clientRef.current = supabase;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as Notification[]) ?? []);
  }, [user]);

  // Initial load + live subscription.
  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserClient();
    clientRef.current = supabase;
    void refresh();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Push-like browser notification when a new one lands and the tab
          // isn't focused.
          if (
            payload.eventType === "INSERT" &&
            typeof document !== "undefined" &&
            document.hidden
          ) {
            const n = payload.new as Notification;
            notify(n.title, n.message);
          }
          void refresh();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, refresh, notify]);

  // Close on outside click — but ignore taps inside the mobile sheet (it's a
  // portal, so it lives outside wrapRef).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (sheetRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    const supabase = clientRef.current ?? createBrowserClient();
    // Optimistic.
    setItems((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)),
    );
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
  }

  async function handleOpen(n: Notification) {
    setOpen(false);
    if (!n.is_read) void markRead([n.id]);
    router.push(hrefFor(n));
  }

  function markAll() {
    markRead(items.filter((n) => !n.is_read).map((n) => n.id));
  }

  const content = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
        <p className="font-display text-sm font-semibold text-stone-900">
          Notifications
        </p>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAll}
            className="press flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-accent-50 text-3xl ring-1 ring-black/5">
              ✅
            </span>
            <p className="font-display text-base font-bold text-stone-900">
              You&apos;re all caught up!
            </p>
            <p className="text-sm text-stone-400">
              New notifications will land here.
            </p>
          </div>
        ) : (
          items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleOpen(n)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-stone-50",
                  !n.is_read && "bg-brand-50/50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    n.is_read
                      ? "bg-stone-100 text-stone-400"
                      : "bg-brand-100 text-brand-700",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-stone-900">
                      {n.title}
                    </span>
                    {!n.is_read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    )}
                  </span>
                  <span className="block text-sm text-stone-500">
                    {n.message}
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-400">
                    {timeAgo(n.created_at)}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="press relative flex h-9 w-9 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* First-visit nudge to enable browser notifications (non-blocking). */}
      {mounted &&
        supported &&
        user &&
        permission === "default" &&
        !bannerDismissed &&
        createPortal(
          <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[55] flex justify-center px-4">
            <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-soft-lg">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Bell className="h-5 w-5" />
              </span>
              <p className="flex-1 text-sm text-stone-700">
                Enable notifications to know when your order arrives.
              </p>
              <button
                type="button"
                onClick={() => {
                  void requestPermission();
                  dismissBanner();
                }}
                className="press rounded-lg bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={dismissBanner}
                aria-label="Dismiss"
                className="press rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* Desktop: anchored dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 hidden max-h-[80vh] w-80 max-w-[calc(100vw-2rem)] origin-top-right animate-scale-in flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft-lg sm:flex">
          {content}
        </div>
      )}

      {/* Mobile: full-width slide-up sheet (portal so it's never clipped) */}
      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[70] sm:hidden">
            <div
              className="absolute inset-0 animate-fade-in bg-stone-900/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              ref={sheetRef}
              className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-soft-lg animate-sheet-up"
            >
              <div className="flex shrink-0 justify-center pb-1 pt-3">
                <span
                  className="h-1.5 w-10 rounded-full bg-stone-300"
                  aria-hidden
                />
              </div>
              {content}
              <div className="pb-safe shrink-0" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
