"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, Menu, X } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { Logo } from "./logo";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/free-check", label: "Free check" },
  { href: "/docs", label: "Docs" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
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

  const isActive = (href: string) => !href.includes("#") && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-surface/80 backdrop-blur-md supports-[backdrop-filter]:bg-surface/70">
      <div className="container-marketing flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={clsx(
                "rounded-lg px-3 py-2 text-small font-medium transition-colors",
                isActive(n.href) ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LinkButton href="/login" variant="ghost" size="sm">
            Log in
          </LinkButton>
          <LinkButton href="/signup" size="sm" iconRight={<ArrowRight />}>
            Free report
          </LinkButton>
        </div>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-lg text-fg hover:bg-surface-2 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden size={22} /> : <Menu aria-hidden size={22} />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="animate-fade-in border-t border-border bg-surface shadow-lg md:hidden">
          <ul className="container-marketing space-y-1 py-3">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={clsx(
                    "block rounded-lg px-3 py-3 text-body font-medium",
                    isActive(n.href) ? "bg-surface-2 text-fg" : "text-fg-soft hover:bg-surface-2",
                  )}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="grid grid-cols-2 gap-2 border-t border-border pt-3">
              <LinkButton href="/login" variant="secondary" fullWidth onClick={() => setOpen(false)}>
                Log in
              </LinkButton>
              <LinkButton href="/signup" fullWidth onClick={() => setOpen(false)}>
                Free report
              </LinkButton>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
