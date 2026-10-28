"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { inkPill } from "./ui";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/free-check", label: "Free check" },
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg">
      <div className="container-marketing flex h-16 items-center justify-between gap-6 lg:h-[72px]">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={clsx(
                "rounded-md py-1 text-[0.9375rem] font-medium transition-colors",
                isActive(n.href) ? "text-fg underline decoration-2 underline-offset-[10px]" : "text-fg-soft hover:text-fg",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          <Link href="/login" className="rounded-md py-1 text-[0.9375rem] font-medium text-fg-soft hover:text-fg">
            Log in
          </Link>
          <Link href="/signup" className={inkPill("md")}>
            Start free
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/signup" className={inkPill("md", false, "h-9 px-4 max-[359px]:hidden")}>
            Start free
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
            <li className="border-b border-border">
              <Link href="/docs" onClick={() => setOpen(false)} className="block py-4 text-[1.375rem] font-medium tracking-[-0.02em] text-fg">
                Docs
              </Link>
            </li>
            <li className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link href="/signup" onClick={() => setOpen(false)} className={inkPill("lg")}>
                Start free
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="inline-flex h-14 items-center justify-center rounded-full border border-border-strong text-[1rem] font-medium text-fg hover:bg-surface-2"
              >
                Log in
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
