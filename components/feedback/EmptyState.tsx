import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Big focal emoji for the default illustration. */
  emoji?: string;
  /** Override the illustration entirely. */
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * A delightful, reusable empty state: a soft gradient "blob" with a focal
 * emoji and a couple of floating accents, a title, optional description and
 * action. Pass `illustration` to fully customise the art.
 */
export function EmptyState({
  emoji = "✨",
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-12 text-center",
        className,
      )}
    >
      {illustration ?? (
        <div className="relative mb-5">
          <div className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-brand-50 to-accent-50 ring-1 ring-black/5">
            <span className="text-5xl">{emoji}</span>
          </div>
          <span className="absolute -right-2 -top-2 animate-float text-xl">
            ✨
          </span>
          <span className="absolute -bottom-1 left-0 h-2.5 w-2.5 animate-float-slow rounded-full bg-accent-400" />
          <span className="absolute -left-3 top-3 h-1.5 w-1.5 rounded-full bg-brand-300" />
        </div>
      )}
      <h3 className="font-display text-lg font-bold text-stone-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-stone-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
