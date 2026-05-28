import Image from "next/image";
import { Clock, MapPin, Package2, User } from "lucide-react";

import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { ETA_RANGE_LABEL, ITEM_CATEGORIES } from "@/lib/constants";
import { formatCurrency, timeAgo } from "@/lib/utils";
import type { OrderWithDetails } from "@/types";

interface OrderCardProps {
  order: OrderWithDetails;
  /** Whose perspective we're rendering for. */
  perspective: "requester" | "runner";
  /** Action buttons rendered in the footer (claim / advance status / cancel). */
  actions?: React.ReactNode;
}

/** A rich summary of a single order, shared by both dashboards. */
export function OrderCard({ order, perspective, actions }: OrderCardProps) {
  const itemCount = order.order_items.reduce((n, li) => n + li.quantity, 0);
  const counterparty =
    perspective === "requester" ? order.runner : order.requester;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft transition-shadow hover:shadow-soft-lg">
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="text-xs text-stone-400">
              #{order.id.slice(0, 8)}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-stone-600">
            <MapPin className="h-4 w-4 shrink-0 text-stone-400" />
            <span className="font-medium text-stone-800">
              {order.delivery_zone}
            </span>
            <span className="truncate text-stone-500">
              · {order.delivery_address}
            </span>
          </p>
          {(order.status === "pending" ||
            order.status === "awaiting_payment") && (
            <p className="mt-1 flex items-center gap-1 text-xs text-stone-400">
              <Clock className="h-3 w-3" /> {ETA_RANGE_LABEL}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-bold text-stone-900">
            {formatCurrency(order.total)}
          </p>
          <p className="flex items-center justify-end gap-1 text-xs text-stone-400">
            <Clock className="h-3 w-3" />
            {timeAgo(order.created_at)}
          </p>
        </div>
      </div>

      {/* Line items */}
      <div className="border-t border-stone-100 px-4 py-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">
          <Package2 className="h-3.5 w-3.5" />
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>

        {/* Thumbnail strip of the items ordered */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {order.order_items.slice(0, 6).map((li) => (
            <span
              key={li.id}
              title={li.item.name}
              className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-white"
            >
              {li.item.image_url ? (
                <Image
                  src={li.item.image_url}
                  alt={li.item.name}
                  fill
                  sizes="36px"
                  className="object-contain p-0.5"
                />
              ) : (
                <span className="text-base" aria-hidden>
                  {ITEM_CATEGORIES.find((c) => c.value === li.item.category)
                    ?.emoji ?? "📦"}
                </span>
              )}
            </span>
          ))}
          {order.order_items.length > 6 && (
            <span className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg bg-stone-100 px-1.5 text-xs font-semibold text-stone-500">
              +{order.order_items.length - 6}
            </span>
          )}
        </div>

        <ul className="space-y-1">
          {order.order_items.map((li) => (
            <li
              key={li.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-stone-700">
                <span className="text-stone-400">{li.quantity}×</span>{" "}
                {li.item.name}
              </span>
              <span className="text-stone-500">
                {formatCurrency(li.price_at_time * li.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {order.delivery_notes && (
          <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
            <span className="font-medium text-stone-700">Note:</span>{" "}
            {order.delivery_notes}
          </p>
        )}
      </div>

      {/* Fee breakdown + counterparty */}
      <div className="grid grid-cols-2 gap-3 border-t border-stone-100 px-4 py-3 text-sm">
        <dl className="space-y-1">
          <div className="flex justify-between text-stone-500">
            <dt>Subtotal</dt>
            <dd>{formatCurrency(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-stone-500">
            <dt>Delivery</dt>
            <dd>{formatCurrency(order.delivery_fee)}</dd>
          </div>
          <div className="flex justify-between text-stone-500">
            <dt>Platform fee</dt>
            <dd>{formatCurrency(order.platform_fee)}</dd>
          </div>
        </dl>
        <div className="flex items-end justify-end">
          {counterparty ? (
            <p className="flex items-center gap-1.5 text-stone-600">
              <User className="h-4 w-4 text-stone-400" />
              <span className="text-xs text-stone-400">
                {perspective === "requester" ? "Runner" : "Requester"}
              </span>
              <span className="font-medium text-stone-800">
                {counterparty.full_name || "—"}
              </span>
            </p>
          ) : (
            <p className="text-xs text-stone-400">
              {perspective === "runner" ? "Unclaimed" : "Awaiting a runner"}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-4 py-3">
          {actions}
        </div>
      )}
    </div>
  );
}
