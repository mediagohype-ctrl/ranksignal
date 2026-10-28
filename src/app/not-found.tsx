import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Gauge, Home, Mail, Tag } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { Logo } from "@/components/marketing/logo";

export const metadata: Metadata = {
  title: "Page not found",
  description: "We couldn't find that page. Try the homepage, the free AI-readiness check, pricing or the docs.",
  robots: { index: false, follow: true },
};

const LINKS = [
  { href: "/", label: "Homepage", body: "What we do, in plain English.", icon: Home },
  { href: "/free-check", label: "Free AI-readiness check", body: "Score your site in about 20 seconds.", icon: Gauge },
  { href: "/pricing", label: "Pricing", body: "Plans and the free trial.", icon: Tag },
  { href: "/docs", label: "Getting started", body: "Set-up guides and how approvals work.", icon: BookOpen },
  { href: "/contact", label: "Contact us", body: "A real person will reply.", icon: Mail },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="container-marketing flex h-16 items-center">
          <Logo />
        </div>
      </header>
      <main id="main" className="container-marketing flex-1 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Error 404</p>
          <h1 className="mt-3 text-balance text-h1 text-fg">We couldn&apos;t find that page</h1>
          <p className="mt-4 text-lead text-fg-soft">The link may be old or mistyped. Here are some places to go instead.</p>
        </div>
        <ul className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="group flex h-full gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                  <l.icon size={18} />
                </span>
                <span>
                  <span className="block text-body font-semibold text-fg group-hover:text-primary">{l.label}</span>
                  <span className="mt-0.5 block text-small text-muted">{l.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <LinkButton href="/app" variant="ghost" iconRight={<ArrowRight />}>
            Go to your dashboard
          </LinkButton>
        </div>
      </main>
    </div>
  );
}
