// About page body, shared by /about and /hi/about so both keep the same short shape:
// headline + proof line (in the hero), a 3-line story, 3 beliefs, one button, and one small grey legal line.
// Server component. No team photo, faces or reviews: none exist yet (the owner must supply real ones).
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BRAND, brandAddressLine } from "@/lib/brand";
import { gstConfig } from "@/lib/billing/gst";
import { LEGAL_ENTITY } from "@/lib/site";
import { PageHero, Section, brightPill } from "@/components/marketing/ui";

export interface AboutCopy {
  eyebrow: string;
  /** The page's H1. */
  title: string;
  /** BRAND.proof, shown big under the headline (translated on the Hindi page). */
  proof: string;
  storyTitle: string;
  /** Exactly three short lines. */
  story: [string, string, string];
  beliefsTitle: string;
  beliefs: [Belief, Belief, Belief];
  ctaTitle: string;
  cta: { label: string; href: string };
  contact: { before: string; label: string; href: string; after: string };
  /** Small grey line at the bottom: "{brand} is a product of {legal name}." */
  productOf: (brand: string, legalName: string) => string;
  gstLabel: string;
  officeLabel: string;
  /** Short note that we are not the similarly named companies (helps Google and AI keep us apart). */
  notRelated: string;
}

interface Belief {
  title: string;
  body: string;
}

/**
 * Legal name and GST number for the small print. The GST number is shown only when GSTIN is set; the legal name
 * is the one on the GST certificate (GST_LEGAL_NAME) when given, else LEGAL_ENTITY.
 */
export function legalSmallPrint(env: Record<string, string | undefined> = process.env): { legalName: string; gstin: string | null } {
  const cfg = gstConfig(env);
  return { legalName: cfg.legalName || LEGAL_ENTITY, gstin: cfg.registered ? cfg.gstin : null };
}

export function AboutBody({ copy }: { copy: AboutCopy }) {
  const { legalName, gstin } = legalSmallPrint();
  const address = brandAddressLine();
  const linkCls = "font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg";
  return (
    <>
      <PageHero eyebrow={copy.eyebrow} title={copy.title} intro={<p className="text-h2 text-navy-fg">{copy.proof}</p>} />

      <Section labelledBy="about-story">
        <div className="mx-auto max-w-3xl">
          <h2 id="about-story" className="text-h2 text-fg">
            {copy.storyTitle}
          </h2>
          <div className="mt-5 space-y-3 text-lead text-fg-soft">
            {copy.story.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </Section>

      <Section labelledBy="about-beliefs" tone="surface">
        <div className="mx-auto max-w-5xl">
          <h2 id="about-beliefs" className="text-h2 text-fg">
            {copy.beliefsTitle}
          </h2>
          <ol className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {copy.beliefs.map((b, i) => (
              <li key={b.title} className="rounded-2xl border border-border bg-bg p-6">
                <span aria-hidden className="text-small font-semibold tabular-nums text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-h4 text-fg">{b.title}</h3>
                <p className="mt-2 text-body leading-relaxed text-fg-soft">{b.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section labelledBy="about-cta">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="about-cta" className="text-h2 text-fg">
            {copy.ctaTitle}
          </h2>
          <p className="mt-6">
            <Link href={copy.cta.href} className={brightPill("lg")}>
              {copy.cta.label}
              <ArrowRight aria-hidden size={18} />
            </Link>
          </p>
          <p className="mt-5 text-body text-fg-soft">
            {copy.contact.before}
            <Link href={copy.contact.href} className={linkCls}>
              {copy.contact.label}
            </Link>
            {copy.contact.after}
          </p>
          {/* The one small grey line: who runs the product, with the GST number only when it is configured. */}
          <p className="mx-auto mt-12 max-w-2xl text-xs leading-relaxed text-muted">
            {copy.productOf(BRAND.name, legalName)}
            {gstin ? ` ${copy.gstLabel}: ${gstin}.` : ""}
            {address ? ` ${copy.officeLabel}: ${address}.` : ""} {copy.notRelated}
          </p>
        </div>
      </Section>
    </>
  );
}
