import { ChevronRight, Clock, MapPin, Package2 } from "lucide-react";

import { cn, formatCurrency, maskAddress, timeAgo } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

interface AvailableOrderCardProps {
  order: OrderWithDetails;
  onAccept: (order: OrderWithDetails) => void;
  /** Animate in from the top when this order just arrived live. */
  isNew?: boolean;
}

/**
 * A claimable order in the runner's live feed. The whole card is one big
 * tap target (tap → accept sheet); the earnings are the loudest element.
 */
export function AvailableOrderCard({
  order,
  onAccept,
  isNew = false,
}: AvailableOrderCardProps) {
  const itemCount = order.order_items.reduce((n, li) => n + li.quantity, 0);
  const names = order.order_items.map((li) => li.item.name);
  const preview =
    names.slice(0, 2).join(", ") +
    (names.length > 2 ? ` +${names.length - 2} more` : "");

  return (
    <button
      type="button"
      onClick={() => onAccept(order)}
      className={cn(
        "press flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft-lg",
        isNew && "animate-slide-down",
      )}
    >
      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-brand-700" />
          <span className="truncate font-display text-base font-bold text-stone-900">
            {order.delivery_zone}
          </span>
          <span className="truncate text-sm text-stone-400">
            · {maskAddress(order.delivery_address)}
          </span>
        </div>

        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-stone-600">
          <Package2 className="h-4 w-4 shrink-0 text-stone-400" />
          <span className="font-medium text-stone-700">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
          <span className="truncate text-stone-400">· {preview}</span>
        </p>

        <p className="mt-1.5 flex items-center gap-1 text-xs text-stone-400">
          <Clock className="h-3 w-3" />
          {timeAgo(order.created_at)}
        </p>
      </div>

      {/* Earnings — the loudest thing on the card */}
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
          Earn
        </span>
        <span className="font-display text-3xl font-extrabold leading-none text-success">
          {formatCurrency(order.delivery_fee)}
        </span>
        <span className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-brand-700">
          Accept <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}
