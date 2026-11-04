"use client";
// Toast for every finished check: polls the latest website check and AI check of the project being viewed and says
// "Website check done. Score 51." / "AI check done. AI named you in 3 of 30 answers." when one finishes.
// Mounted once in src/app/app/layout.tsx (inside ToastProvider). Polls fast while a run is active, slowly otherwise,
// and not at all while the tab is hidden.
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { aiDoneMessage, crawlDoneMessage, toastDecision, type RunStatusItem, type RunStatusPayload } from "@/lib/dashboard/run-status";

const FAST_MS = 5_000;
const SLOW_MS = 30_000;
const SEEN_KEY = "rs.runToasts";

function seenBefore(id: string): boolean {
  try {
    const list = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[];
    if (list.includes(id)) return true;
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...list.slice(-30), id]));
  } catch {
    /* storage blocked: the in-memory set still prevents repeats on this page */
  }
  return false;
}

export function projectIdFromPath(pathname: string | null): string | null {
  const m = pathname?.match(/^\/app\/projects\/([^/?#]+)/);
  return m && m[1] !== "new" ? decodeURIComponent(m[1]) : null;
}

export function RunWatcher() {
  const projectId = projectIdFromPath(usePathname());
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (!projectId) return;
    const since = Date.now();
    const announced = new Set<string>();
    let last: { crawl: RunStatusItem | null; visibility: RunStatusItem | null } = { crawl: null, visibility: null };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let controller: AbortController | undefined;
    let inFlight = false;

    const announce = (id: string, msg: { message: string; tone: "success" | "error" }) => {
      if (announced.has(id)) return;
      announced.add(id);
      if (!seenBefore(id)) toastRef.current(msg.message, msg.tone);
    };

    const tick = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      let active = false;
      if (document.visibilityState === "visible") {
        try {
          controller = new AbortController();
          const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/runs/status`, { cache: "no-store", signal: controller.signal });
          if (res.ok) {
            const cur = (await res.json()) as RunStatusPayload;
            const next = { ...last };
            const c = toastDecision(last.crawl, cur.crawl, since);
            if (c === "toast" && cur.crawl) announce(`crawl:${cur.crawl.id}`, crawlDoneMessage(cur.crawl));
            if (c !== "wait") next.crawl = cur.crawl; // waiting for the score: keep the old state so we look again
            const v = toastDecision(last.visibility, cur.visibility, since);
            if (v === "toast" && cur.visibility) announce(`vis:${cur.visibility.id}`, aiDoneMessage(cur.visibility));
            if (v !== "wait") next.visibility = cur.visibility;
            last = next;
            active = !!cur.crawl?.active || !!cur.visibility?.active || c === "wait" || v === "wait";
          }
        } catch {
          /* offline or navigating away — try again later */
        }
      }
      inFlight = false;
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(tick, active ? FAST_MS : SLOW_MS);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    };
    // Starting a check elsewhere on the page (run buttons) should speed polling up right away.
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("button")) {
        clearTimeout(timer);
        timer = setTimeout(tick, 2_000);
      }
    };
    void tick();
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("click", onClick);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("click", onClick);
    };
  }, [projectId]);

  return null;
}
