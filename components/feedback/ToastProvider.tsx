"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const DURATION = 4000;

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: React.ComponentType<{ className?: string }>; accent: string }
> = {
  success: { icon: CheckCircle2, accent: "text-emerald-600" },
  error: { icon: AlertCircle, accent: "text-rose-600" },
  info: { icon: Info, accent: "text-brand-600" },
};

/** App-wide toast notifications. Mount once near the root. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, variant, message }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[60] flex flex-col items-center gap-2 px-4">
            {toasts.map((t) => {
              const { icon: Icon, accent } = VARIANT_STYLES[t.variant];
              return (
                <div
                  key={t.id}
                  role="status"
                  className="pointer-events-auto flex w-full max-w-sm animate-slide-down items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
                >
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", accent)} />
                  <p className="flex-1 text-sm text-slate-800">{t.message}</p>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss"
                    className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

/** Trigger toasts: `const toast = useToast(); toast.success("Saved")`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>.");
  }
  return ctx;
}
