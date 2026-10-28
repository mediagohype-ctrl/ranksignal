import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Logo } from "./logo";
import { ENGINES } from "./ui";

const COLS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/#sample", label: "Sample report" },
      { href: "/free-check", label: "Free AI-readiness check" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "Getting started" },
      { href: "/#explained", label: "SEO vs AEO vs GEO" },
      { href: "/#faq", label: "FAQ" },
      { href: "/contact", label: "Contact us" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/signup", label: "Start free trial" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="container-marketing grid gap-14 pb-14 pt-16 sm:pt-20 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <Logo />
          <p className="mk-body mt-5 max-w-sm text-fg-soft">
            Find out what AI assistants say about your business, and what to fix so they get it right.
          </p>
          <p className="mt-6 text-small text-muted">Measures answers from {ENGINES.join(", ")}.</p>
          <p className="mt-6">
            <a
              href={`mailto:${BRAND.supportEmail}`}
              className="text-[0.9375rem] font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              {BRAND.supportEmail}
            </a>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-7">
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="mk-label">{c.title}</p>
              <ul className="mt-5 space-y-3.5">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[0.9375rem] text-fg-soft transition-colors hover:text-fg">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-marketing grid gap-4 py-8 text-xs leading-relaxed text-muted lg:grid-cols-12">
          <p className="lg:col-span-3">
            © {new Date().getFullYear()} {BRAND.name}
          </p>
          <p className="max-w-4xl lg:col-span-9">
            AI answer visibility is measured from samples and changes over time; no ranking, mention or citation
            outcome is guaranteed. ChatGPT, Gemini, Perplexity, Claude, Copilot and Google AI Overviews are trademarks of their
            respective owners; {BRAND.name} is not affiliated with or endorsed by them.
          </p>
        </div>
      </div>
    </footer>
  );
}
