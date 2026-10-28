"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

/** Re-renders the server component tree every `intervalMs` while `active` (e.g. runs queued/running). */
export function AutoRefresh({ active, intervalMs = 3000, label }: { active: boolean; intervalMs?: number; label?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, intervalMs, router]);
  if (!active || !label) return null;
  return (
    <div
      className="no-print inline-flex items-center gap-2 rounded-full border border-info/30 bg-info-soft px-3 py-1 text-xs font-medium text-info animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <Spinner size={12} /> {label}
      <span className="sr-only">This page updates automatically.</span>
    </div>
  );
}
