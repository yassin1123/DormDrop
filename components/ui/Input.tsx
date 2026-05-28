import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/** Labelled text input with hint + error slots and accessible wiring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, id, ...props },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "block h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors",
          "placeholder:text-slate-400",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30",
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/30"
            : "border-slate-300",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
