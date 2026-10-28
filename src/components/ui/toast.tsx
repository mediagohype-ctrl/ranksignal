"use client";
import { createContext, useCallback, useContext, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastTone = "success" | "error" | "info" | "warning";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastCtx = createContext<{ toast: (message: string, tone?: ToastTone) => void }>({
  toast: () => {},
});

let nextId = 1;

const ICON = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle } as const;
const ICON_CLS: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-primary",
  warning: "text-warning",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId++;
      setItems((xs) => [...xs.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4500);
    },
    [dismiss],
  );
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {items.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className={clsx(
                "pointer-events-auto flex animate-pop-in items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-small text-fg shadow-lg",
              )}
            >
              <Icon aria-hidden size={18} className={clsx("mt-px shrink-0", ICON_CLS[t.tone])} />
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
                className="-mr-1 rounded-md p-0.5 text-muted hover:bg-surface-2 hover:text-fg"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx).toast;
}
