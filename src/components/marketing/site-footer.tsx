import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Logo } from "./logo";
import { EngineChips } from "./ui";

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
    <footer className="border-t border-border bg-surface">
      <div className="container-marketing grid gap-12 py-14 lg:grid-cols-[1.4fr_2fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-small leading-relaxed text-muted">{BRAND.tagline}</p>
          <p className="mt-6 text-caption uppercase tracking-[0.06em] text-muted">We measure answers from</p>
          <EngineChips className="mt-3" />
          <p className="mt-6 text-small">
            <a href={`mailto:${BRAND.supportEmail}`} className="font-medium text-fg-soft hover:text-primary">
              {BRAND.supportEmail}
            </a>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="text-caption uppercase tracking-[0.06em] text-muted">{c.title}</p>
              <ul className="mt-4 space-y-3">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-small text-fg-soft transition-colors hover:text-primary">
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
        <div className="container-marketing py-6 text-xs leading-relaxed text-muted">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. AI answer visibility is measured from samples and changes over
            time; no ranking, mention or citation outcome is guaranteed. ChatGPT, Gemini, Perplexity and Google AI
            Overviews are trademarks of their respective owners; {BRAND.name} is not affiliated with or endorsed by
            them.
          </p>
        </div>
      </div>
    </footer>
  );
}
