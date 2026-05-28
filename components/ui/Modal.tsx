"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** Footer actions row (e.g. Cancel / Confirm buttons). */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Accessible modal dialog rendered through a portal. Closes on Escape and on
 * backdrop click, and locks body scroll while open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  // Render nothing on the server / when closed. (document is undefined on SSR.)
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Bottom sheet on mobile, centred dialog on desktop. */}
      <div
        className={cn(
          "relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl",
          "animate-sheet-up sm:max-w-lg sm:rounded-2xl sm:animate-scale-in",
          className,
        )}
      >
        {/* Cosmetic drag handle — signals "this is a sheet" on mobile. */}
        <div className="flex shrink-0 justify-center pb-1 pt-3 sm:hidden">
          <span className="h-1.5 w-10 rounded-full bg-slate-300" aria-hidden />
        </div>

        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-3 sm:pt-5">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">{children}</div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
