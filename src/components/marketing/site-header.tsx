"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Menu, MessageCircle, X } from "lucide-react";
import { Logo } from "./logo";
import { brightPill } from "./ui";
import { LanguageSwitch, SHOW_LANGUAGE_SWITCH } from "./hi/language-switch";
import { newTabProps } from "./plans";
import { useSignedIn } from "./signed-in";
import { WHATSAPP_HELP_MESSAGE, brandWhatsappHref } from "@/lib/brand";

// Website Blueprint: five menu items + one bright button. Features, Done-for-you, Blog, Contact and Docs live in the footer.
const NAV = [
  { href: "/free-check", label: "Free Check" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/tools", label: "Free Tools" },
  { href: "/learn", label: "Learn" },
];

const CTA = { href: "/free-check", label: "Check my website free", short: "Check free" };
// Opens WhatsApp with a ready-typed message, never an empty chat.
const WHATSAPP = brandWhatsappHref(WHATSAPP_HELP_MESSAGE);

function WhatsAppLink({ className }: { className?: string }) {
  return (
    <a
      href={WHATSAPP}
      {...newTabProps(WHATSAPP)}
      aria-label="Chat with us on WhatsApp (opens in a new tab)"
      title="Chat with us on WhatsApp"
      className={clsx(
        "inline-flex size-9 items-center justify-center rounded-full bg-[#25D366]/12 text-[#128C7E] ring-1 ring-[#25D366]/30 transition-colors hover:bg-[#25D366]/20",
        className,
      )}
    >
      <MessageCircle aria-hidden size={18} strokeWidth={2.25} />
    </a>
  );
}

/** Signed-in visitors get "Open app": checked in the browser, so marketing pages stay cacheable (see signed-in.tsx). */
export function SiteHeader() {
  const signedIn = useSignedIn();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu on navigation and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/80 bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
      <div className="container-marketing flex h-16 items-center justify-between gap-3 lg:h-[72px] lg:gap-6">
        <div className="min-w-0 shrink">
          {/* Smaller logo on phones so the button and menu always fit beside it. */}
          <Logo size="sm" className="sm:hidden" />
          <Logo className="max-sm:hidden" />
        </div>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={clsx(
                "rounded-full px-3.5 py-2 text-[0.9375rem] font-medium transition-colors",
                isActive(n.href) ? "bg-primary-soft text-primary" : "text-fg-soft hover:bg-surface-2 hover:text-fg",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitch variant="toggle" />
          <Link
            href={signedIn ? "/app" : "/login"}
            className="rounded-full px-3 py-2 text-[0.9375rem] font-medium text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {signedIn ? "Open app" : "Log in"}
          </Link>
          <WhatsAppLink />
          <span aria-hidden className="h-6 w-px bg-border" />
          <Link href={CTA.href} className={brightPill("md")}>
            {CTA.label}
          </Link>
        </div>

        {/* Phones: bright button + menu only (WhatsApp moves into the menu), so the menu button never falls off-screen. */}
        <div className="-mr-2 flex shrink-0 items-center gap-1.5 lg:hidden">
          <WhatsAppLink className="max-sm:hidden" />
          <Link href={CTA.href} className={brightPill("md", "h-9 whitespace-nowrap px-3.5 text-[0.875rem] max-[339px]:hidden")}>
            {CTA.short}
          </Link>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full text-fg hover:bg-surface-2"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden size={22} /> : <Menu aria-hidden size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="animate-fade-in absolute inset-x-0 top-full h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-bg lg:hidden"
        >
          <ul className="container-marketing py-4">
            {NAV.map((n) => (
              <li key={n.href} className="border-b border-border">
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={clsx(
                    "block py-4 text-[1.375rem] font-medium tracking-[-0.02em]",
                    isActive(n.href) ? "text-primary" : "text-fg",
                  )}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="border-b border-border sm:hidden">
              <a
                href={WHATSAPP}
                {...newTabProps(WHATSAPP)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 py-4 text-[1.375rem] font-medium tracking-[-0.02em] text-fg"
              >
                <MessageCircle aria-hidden size={22} className="text-[#128C7E]" />
                Chat on WhatsApp
              </a>
            </li>
            {SHOW_LANGUAGE_SWITCH && (
              <li className="border-b border-border">
                <LanguageSwitch onClick={() => setOpen(false)} className="w-full py-4 text-[1.375rem] tracking-[-0.02em] text-fg" />
              </li>
            )}
            <li className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link href={CTA.href} onClick={() => setOpen(false)} className={brightPill("lg")}>
                {CTA.label}
              </Link>
              <Link
                href={signedIn ? "/app" : "/login"}
                onClick={() => setOpen(false)}
                className="inline-flex h-14 items-center justify-center rounded-full border border-border-strong text-[1rem] font-medium text-fg hover:bg-surface-2"
              >
                {signedIn ? "Open app" : "Log in"}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
    {/* Spacer: same height as the fixed header, so page content starts below it. */}
    <div aria-hidden className="h-16 lg:h-[72px]" />
    </>
  );
}
