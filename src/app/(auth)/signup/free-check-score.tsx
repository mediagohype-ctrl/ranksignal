"use client";
// "Your score: 61. Let's get it to 75." on the sign-up page, only when this visitor ran the free check on the same
// website in this tab (see src/lib/free-check/last-check.ts). Never a made-up number: no record, no panel.
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Gauge } from "lucide-react";
import { recallLastCheck, scoreHeadline, type LastCheck } from "@/lib/free-check/last-check";

export function FreeCheckScore({ tone = "light" }: { tone?: "light" | "navy" }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const website = params.get("website");
  const [check, setCheck] = useState<LastCheck | null>(null);

  useEffect(() => {
    // Read after mount: sessionStorage only exists in the browser.
    setCheck(pathname === "/signup" ? recallLastCheck(website) : null);
  }, [pathname, website]);

  if (!check) return null;
  const h = scoreHeadline(check);
  const navy = tone === "navy";
  return (
    <div
      role="note"
      className={
        navy
          ? "flex items-start gap-3 rounded-2xl border border-navy-fg/15 bg-navy-fg/10 p-4 text-navy-fg"
          : "flex items-start gap-3 rounded-2xl border border-border bg-surface-2 p-4 text-fg"
      }
    >
      <span aria-hidden className={navy ? "mt-0.5 text-navy-fg" : "mt-0.5 text-primary"}>
        <Gauge size={18} />
      </span>
      <p className="text-small">
        <strong className="font-semibold">{h.score}</strong> {h.goal}
        <span className={navy ? "mt-0.5 block text-xs text-navy-fg/75" : "mt-0.5 block text-xs text-muted"}>
          From your free check of {check.host}.
        </span>
      </p>
    </div>
  );
}
