import { socialIcon } from "@/components/marketing/social-icons";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { BRAND, WHATSAPP_HELP_MESSAGE, brandLocationLine, brandWhatsappHref } from "@/lib/brand";
import { Logo } from "./logo";
import { ENGINES_MEASURED_LINE } from "./engine-names";
import { ProofLine } from "./proof-line";
import { AccountLink } from "./signed-in";
import { LanguageSwitch } from "./hi/language-switch";

type FooterLink = { href: string; label: string; account?: boolean };

const COLS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/features", label: "Features" },
      { href: "/features/ai-visibility-tracking", label: "AI visibility tracking" },
      { href: "/seo-services-small-business", label: "SEO for small businesses" },
      { href: "/done-for-you", label: "Done-for-you services" },
      { href: "/pricing", label: "Pricing" },
      { href: "/compare", label: "Compare SEO tools" },
      { href: "/compare/ahrefs", label: "MyWebRank vs Ahrefs" },
      { href: "/compare/semrush", label: "MyWebRank vs Semrush" },
      { href: "/compare/ahrefs-alternatives", label: "Ahrefs alternatives" },
      { href: "/compare/semrush-alternatives", label: "Semrush alternatives" },
    ],
  },
  {
    title: "Free tools",
    links: [
      { href: "/tools", label: "All free tools" },
      { href: "/free-check", label: "Free SEO checker" },
      { href: "/tools/ai-visibility-checker", label: "AI visibility checker" },
      { href: "/tools/ai-crawler-checker", label: "AI crawler checker" },
      { href: "/tools/meta-tag-checker", label: "Meta tag checker" },
      { href: "/tools/broken-link-checker", label: "Broken link checker" },
      { href: "/tools/schema-checker", label: "Schema checker" },
      { href: "/tools/robots-txt-tester", label: "Robots.txt tester" },
      { href: "/tools/sitemap-checker", label: "Sitemap checker" },
      { href: "/tools/seo-title-generator", label: "SEO title generator" },
      { href: "/tools/faq-schema-generator", label: "FAQ schema generator" },
      { href: "/tools/llms-txt-generator", label: "llms.txt generator" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/learn", label: "SEO, AEO & GEO guides" },
      { href: "/learn/what-is-aeo", label: "What is AEO?" },
      { href: "/learn/what-is-geo", label: "What is GEO?" },
      { href: "/learn/how-to-get-mentioned-by-chatgpt", label: "Get on ChatGPT" },
      { href: "/hi", label: "हिन्दी में पढ़ें" },
      { href: "/learn/website-seo-audit-checklist", label: "SEO audit checklist" },
      { href: "/docs", label: "Getting started" },
      { href: "/docs/api", label: "API & MCP docs" },
      { href: "/#faq", label: "FAQ" },
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact us" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/signup", label: "Start free trial" },
      // "Log in" becomes "Open app" for signed-in visitors (checked in the browser, so pages stay cacheable).
      { href: "/login", label: "Log in", account: true },
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

/** Readable site name for a profile URL (linkedin.com → LinkedIn), from its hostname. */
const PROFILE_NAMES: Record<string, string> = {
  "linkedin.com": "LinkedIn",
  "x.com": "X",
  "twitter.com": "X",
  "youtube.com": "YouTube",
  "facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "github.com": "GitHub",
  "crunchbase.com": "Crunchbase",
  "g2.com": "G2",
  "producthunt.com": "Product Hunt",
  "medium.com": "Medium",
  "threads.net": "Threads",
};

function profileName(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^(www|m)\./, "");
  } catch {
    return url;
  }
  const known = Object.keys(PROFILE_NAMES).find((h) => host === h || host.endsWith(`.${h}`));
  if (known) return PROFILE_NAMES[known];
  const label = host.split(".").slice(-2, -1)[0] ?? host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function SiteFooter() {
  const location = brandLocationLine();
  const whatsapp = brandWhatsappHref(WHATSAPP_HELP_MESSAGE);
  return (
    <footer className="border-t border-border bg-bg">
      <div className="container-marketing grid grid-cols-1 gap-14 pb-14 pt-16 sm:pt-20 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <Logo />
          <p className="mk-body mt-5 max-w-sm text-fg-soft">
            Find out what AI assistants say about your business, and what to fix so they get it right.
          </p>
          {/* Built from the plan limits (engine-names.ts), so the footer never claims more AI tools than a plan checks. */}
          <p className="mt-6 max-w-sm text-small text-muted">{ENGINES_MEASURED_LINE}</p>
          <ProofLine className="mt-6" />
          <ul className="mt-4 space-y-2">
            <li>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[0.9375rem] font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
              >
                <MessageCircle aria-hidden size={16} className="shrink-0 text-success" />
                Chat on WhatsApp
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="text-[0.9375rem] font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
              >
                {BRAND.supportEmail}
              </a>
            </li>
          </ul>
          {/* Office city, from BRAND_ADDRESS_LOCALITY (nothing is shown until it is set). */}
          {location && <p className="mt-3 text-small text-muted">Office: {location}</p>}
          {BRAND.sameAs.length > 0 && (
            <ul aria-label={`${BRAND.name} on other sites`} className="mt-6 flex flex-wrap items-center gap-2.5">
              {BRAND.sameAs.map((url) => {
                const name = profileName(url);
                const icon = socialIcon(name);
                return (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="me noopener noreferrer"
                      aria-label={`${BRAND.name} on ${name} (opens in a new tab)`}
                      title={name}
                      className={
                        icon
                          ? "inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface text-fg-soft transition-colors hover:border-border-strong hover:text-fg"
                          : "inline-flex h-9 items-center rounded-full border border-border bg-surface px-3.5 text-small text-fg-soft transition-colors hover:border-border-strong hover:text-fg"
                      }
                    >
                      {icon ?? name}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-5 lg:gap-8">
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="mk-label">{c.title}</p>
              <ul className="mt-5 space-y-3.5">
                {c.links.map((l) => (
                  <li key={l.href}>
                    {l.account ? (
                      <AccountLink className="text-[0.9375rem] text-fg-soft transition-colors hover:text-fg" />
                    ) : (
                      <Link href={l.href} className="text-[0.9375rem] text-fg-soft transition-colors hover:text-fg">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-marketing grid grid-cols-1 gap-4 py-8 text-xs leading-relaxed text-muted lg:grid-cols-12">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:col-span-3 lg:flex-col lg:items-start">
            <p>
              © {new Date().getFullYear()} {BRAND.name}
            </p>
            <LanguageSwitch className="text-small" />
          </div>
          <p className="max-w-4xl lg:col-span-9">
            AI answers change over time, and we measure them from samples. We can&apos;t promise a Google position, an AI
            mention or a link to your site. ChatGPT, Gemini, Perplexity, Claude, Grok and Google AI Overviews are trademarks of their
            respective owners; {BRAND.name} is not affiliated with or endorsed by them.
          </p>
        </div>
      </div>
    </footer>
  );
}
