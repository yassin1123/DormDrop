import { Check, Loader2, XCircle } from "lucide-react";

import { ORDER_STATUS_FLOW, ORDER_STATUSES } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types";

type TrackerOrder = Pick<
  Order,
  | "status"
  | "created_at"
  | "accepted_at"
  | "picked_up_at"
  | "delivered_at"
  | "cancelled_at"
>;

/** Which timestamp column marks the moment each step happened. */
const STEP_STAMP: Partial<Record<OrderStatus, keyof TrackerOrder>> = {
  pending: "created_at",
  accepted: "accepted_at",
  picking_up: "picked_up_at",
  delivered: "delivered_at",
};

/**
 * Vertical progress timeline: Pending → Accepted → Picking Up → On the Way →
 * Delivered. Completed steps show a tick + timestamp on a green line, the
 * current step glows/pulses, upcoming steps are muted. A cancelled order shows
 * a dedicated banner; an unpaid order shows a "processing" state.
 */
export function OrderStatusTracker({ order }: { order: TrackerOrder }) {
  if (order.status === "awaiting_payment") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-stone-50 p-4 text-stone-600">
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-stone-400" />
        <div>
          <p className="font-medium text-stone-800">Processing payment…</p>
          <p className="text-sm text-stone-500">
            We&apos;ll find you a runner the moment your payment confirms.
          </p>
        </div>
      </div>
    );
  }

  if (order.status === "cancelled") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-red-700">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">Order cancelled</p>
          {order.cancelled_at && (
            <p className="text-sm text-red-600">
              {formatDateTime(order.cancelled_at)}
            </p>
          )}
        </div>
      </div>
    );
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);

  return (
    <ol className="relative">
      {ORDER_STATUS_FLOW.map((status, i) => {
        const config = ORDER_STATUSES[status];
        const done = i < currentIndex;
        const active = i === currentIndex;
        const isLast = i === ORDER_STATUS_FLOW.length - 1;
        const stamp = STEP_STAMP[status];
        const time = stamp ? (order[stamp] as string | null) : null;

        return (
          <li key={status} className="flex gap-3">
            {/* Marker + connector */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                  done || active
                    ? "bg-brand-600 text-white"
                    : "bg-stone-200 text-stone-400",
                  active && "animate-glow",
                )}
              >
                {active && (
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500" />
                )}
                {done ? (
                  <Check className="h-5 w-5" />
                ) : active ? (
                  <span className="relative h-2.5 w-2.5 rounded-full bg-white" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-stone-400" />
                )}
              </span>
              {!isLast && (
                <span
                  className={cn(
                    "my-1 w-0.5 flex-1",
                    i < currentIndex ? "bg-brand-500" : "bg-stone-200",
                  )}
                />
              )}
            </div>

            {/* Label + timestamp */}
            <div className={cn("pb-7", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-[15px] leading-10",
                  active
                    ? "font-bold text-brand-800"
                    : done
                      ? "font-semibold text-stone-900"
                      : "font-medium text-stone-400",
                )}
              >
                {config.label}
              </p>
              {active ? (
                <p className="text-xs font-medium text-brand-600">
                  In progress…
                </p>
              ) : time ? (
                <p className="text-xs text-stone-400">{formatDateTime(time)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
