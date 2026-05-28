import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/** Labelled multi-line text input, styled to match Input. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, label, hint, error, id, rows = 3, ...props }, ref) {
    const reactId = useId();
    const fieldId = id ?? reactId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={fieldId}
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          className={cn(
            "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors",
            "placeholder:text-slate-400",
            "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30",
            error ? "border-rose-400" : "border-slate-300",
            className,
          )}
          {...props}
        />
        {error ? (
          <p className="mt-1.5 text-sm text-rose-600">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);
