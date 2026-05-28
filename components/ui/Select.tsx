import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

/** Labelled native select — reliable across browsers, styled to match Input. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { className, label, hint, error, options, placeholder, id, ...props },
    ref,
  ) {
    const reactId = useId();
    const selectId = id ?? reactId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            className={cn(
              "block h-11 w-full appearance-none rounded-lg border bg-white pl-3 pr-9 text-sm text-slate-900 shadow-sm transition-colors",
              "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30",
              error ? "border-rose-400" : "border-slate-300",
              "disabled:cursor-not-allowed disabled:bg-slate-50",
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
        </div>
        {error ? (
          <p className="mt-1.5 text-sm text-rose-600">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);
