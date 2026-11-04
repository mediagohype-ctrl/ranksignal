"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps Home live while an AI check runs: refreshes the page every ~15 s while `running`, then a couple more
 * times just after it finishes (the score is stored a moment after the run ends), so the new results show up
 * without a reload. Renders nothing.
 */
export function AiCheckRefresh({ running, intervalMs = 15_000 }: { running: boolean; intervalMs?: number }) {
  const router = useRouter();
  const wasRunning = useRef(running);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(t);
  }, [running, intervalMs, router]);

  useEffect(() => {
    if (running) {
      wasRunning.current = true;
      return;
    }
    if (!wasRunning.current) return;
    wasRunning.current = false;
    const timers = [4_000, 15_000].map((ms) => setTimeout(() => router.refresh(), ms));
    return () => timers.forEach(clearTimeout);
  }, [running, router]);

  return null;
}
