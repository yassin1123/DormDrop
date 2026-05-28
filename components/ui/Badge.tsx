import { cn } from "@/lib/utils";

type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-600/20",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
  info: "bg-blue-50 text-blue-700 ring-blue-600/20",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Pass a ready-made Tailwind class set (e.g. from ORDER_STATUSES). */
  classOverride?: string;
}

/**
 * Small status pill. Either pick a semantic `variant` or pass a precomputed
 * `classOverride` (used by OrderStatusBadge to reuse the constants table).
 */
export function Badge({
  className,
  variant = "neutral",
  classOverride,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        classOverride ?? variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
