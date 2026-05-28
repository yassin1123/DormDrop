import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-900 text-white shadow-soft hover:bg-brand-800 hover:shadow-soft-lg active:bg-brand-950",
  secondary:
    "bg-accent-500 text-white shadow-soft hover:bg-accent-600 hover:shadow-soft-lg active:bg-accent-600",
  outline:
    "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 active:bg-stone-100",
  ghost: "text-stone-700 hover:bg-stone-100 active:bg-stone-200",
  danger:
    "bg-red-500 text-white shadow-soft hover:bg-red-600 active:bg-red-700",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

/**
 * Primary action button. Tactile by default: a quick press-scale, hover lift on
 * filled variants, and a built-in loading state (disables + spinner).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex select-none items-center justify-center rounded-xl font-semibold",
          "transition-all duration-150 ease-out active:scale-[0.97]",
          "disabled:pointer-events-none disabled:opacity-60",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);
