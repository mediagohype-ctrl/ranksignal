"use client";
// Floating WhatsApp button, bottom-right on every public page. A small "Chat with us" bubble pops up once per visit
// after 30 seconds (closable, remembered for the session) — never on the free-check pages, where it would cover the
// check's buttons. While a check is running the whole button steps aside. The link opens WhatsApp with a ready message.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

const SEEN_KEY = "mwr.waBubbleSeen";
const BUBBLE_AFTER_MS = 30_000;
/** Same name as BUSY_EVENT in free-check-tool.tsx (not imported, to keep that bundle off every page). */
const CHECK_BUSY_EVENT = "mwr:free-check-busy";
const NO_BUBBLE = /^\/(hi\/)?free-check\/?$/;

/** Official WhatsApp glyph (white), drawn inline so there is no extra request. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className} fill="currentColor">
      <path d="M16.004 3C8.82 3 3 8.82 3 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.75A12.94 12.94 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16.004 3Zm0 23.8c-1.98 0-3.92-.53-5.61-1.53l-.4-.24-3.96 1.04 1.06-3.86-.26-.4A10.76 10.76 0 0 1 5.2 16c0-5.96 4.85-10.8 10.8-10.8 5.96 0 10.8 4.84 10.8 10.8 0 5.95-4.84 10.8-10.8 10.8Zm5.92-8.09c-.32-.16-1.92-.95-2.22-1.06-.3-.11-.51-.16-.73.16-.21.32-.84 1.06-1.03 1.27-.19.22-.38.24-.7.08-.32-.16-1.37-.5-2.6-1.6-.96-.86-1.61-1.92-1.8-2.24-.19-.32-.02-.5.14-.66.15-.14.32-.38.48-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.4-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.69 0 1.58 1.16 3.12 1.32 3.33.16.22 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.25 1.48.21 2.03.13.62-.09 1.92-.78 2.19-1.54.27-.76.27-1.4.19-1.54-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

export function WhatsAppFloat({ href }: { href: string }) {
  const [bubble, setBubble] = useState(false);
  const [checkBusy, setCheckBusy] = useState(false);
  const pathname = usePathname() ?? "";
  const bubbleAllowed = !NO_BUBBLE.test(pathname);

  useEffect(() => {
    const on = (e: Event) => setCheckBusy(Boolean((e as CustomEvent<{ busy?: boolean }>).detail?.busy));
    window.addEventListener(CHECK_BUSY_EVENT, on);
    return () => window.removeEventListener(CHECK_BUSY_EVENT, on);
  }, []);

  useEffect(() => {
    if (!bubbleAllowed) {
      setBubble(false);
      return;
    }
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* private mode: just show it */
    }
    if (seen) return;
    const t = setTimeout(() => setBubble(true), BUBBLE_AFTER_MS);
    return () => clearTimeout(t);
  }, [bubbleAllowed]);

  const closeBubble = () => {
    setBubble(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (checkBusy) return null;

  return (
    <div className="no-print fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex items-end gap-3 sm:bottom-6 sm:right-6">
      {bubble && (
        <div
          role="status"
          className="animate-fade-in relative mb-2 max-w-[15rem] rounded-2xl border border-border bg-surface px-4 py-3 pr-9 text-small text-fg shadow-lg"
        >
          <p className="font-semibold">Need help? Chat with us</p>
          <p className="mt-0.5 text-xs text-muted">A real person replies on WhatsApp.</p>
          <button
            type="button"
            onClick={closeBubble}
            aria-label="Close"
            className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X aria-hidden size={14} />
          </button>
          {/* little tail pointing at the button */}
          <span aria-hidden className="absolute -right-1.5 bottom-4 size-3 rotate-45 border-r border-t border-border bg-surface" />
        </div>
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={closeBubble}
        aria-label="Chat with us on WhatsApp (opens in a new tab)"
        title="Chat with us on WhatsApp"
        className="group relative inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E] motion-safe:active:scale-95"
      >
        <span aria-hidden className="absolute inset-0 rounded-full bg-[#25D366] opacity-40 motion-safe:animate-ping [animation-duration:2.5s]" />
        <WhatsAppGlyph className="relative size-8" />
      </a>
    </div>
  );
}
