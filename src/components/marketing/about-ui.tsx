// About page body, shared by /about and /hi/about so both keep the same short shape:
// headline + proof line (in the hero), a 3-line story, 3 beliefs, one button, and one small grey legal line.
// Server component. No team photo, faces or reviews: none exist yet (the owner must supply real ones).
// The English page adds optional sections (where the proof number comes from, what we do, how we work, who writes
// our guides, company details); the Hindi page leaves them out until they are translated.
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { authorInitials, type Author } from "@/lib/authors";
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
  /** Optional: one plain line under the proof saying where the number comes from. */
  proofSource?: string;
  /** Optional: what the product does, one row per score. */
  whatWeDo?: { title: string; intro: string; items: { name: string; body: string }[]; outro: string[] };
  /** Optional: how we work, a short list of promises we can keep. */
  howWeWork?: { title: string; items: { title: string; body: string }[] };
  /** Optional: the person who leads our guides and product content. */
  team?: { title: string; intro: string; author: Author; href: string; linkLabel: string };
  /** Optional: company details (legal name, city, address, contact). Rows with an empty value are left out. */
  company?: { title: string; intro: string; rows: CompanyRow[] };
}

interface Belief {
  title: string;
  body: string;
}

export interface CompanyRow {
  label: string;
  value: string;
  href?: string;
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
      <PageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        intro={
          <>
            <p className="text-h2 text-navy-fg">{copy.proof}</p>
            {copy.proofSource && <p className="mt-3 text-body text-navy-fg/80">{copy.proofSource}</p>}
          </>
        }
      />

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

      {copy.whatWeDo && (
        <Section labelledBy="about-what" tone="surface">
          <div className="mx-auto max-w-3xl">
            <h2 id="about-what" className="text-h2 text-fg">
              {copy.whatWeDo.title}
            </h2>
            <p className="mt-5 text-lead text-fg-soft">{copy.whatWeDo.intro}</p>
            <dl className="mt-6 space-y-4">
              {copy.whatWeDo.items.map((item) => (
                <div key={item.name} className="rounded-2xl border border-border bg-bg p-5">
                  <dt className="text-h4 text-fg">{item.name}</dt>
                  <dd className="mt-1 text-body leading-relaxed text-fg-soft">{item.body}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 space-y-3 text-body leading-relaxed text-fg-soft">
              {copy.whatWeDo.outro.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section labelledBy="about-beliefs" tone={copy.whatWeDo ? "bg" : "surface"}>
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

      {copy.howWeWork && (
        <Section labelledBy="about-how" tone="surface">
          <div className="mx-auto max-w-3xl">
            <h2 id="about-how" className="text-h2 text-fg">
              {copy.howWeWork.title}
            </h2>
            <ul className="mt-6 space-y-5">
              {copy.howWeWork.items.map((item) => (
                <li key={item.title}>
                  <h3 className="text-h4 text-fg">{item.title}</h3>
                  <p className="mt-1 text-body leading-relaxed text-fg-soft">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {copy.team && (
        <Section labelledBy="about-team">
          <div className="mx-auto max-w-3xl">
            <h2 id="about-team" className="text-h2 text-fg">
              {copy.team.title}
            </h2>
            <p className="mt-5 text-lead text-fg-soft">{copy.team.intro}</p>
            <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-start">
              <AuthorAvatar author={copy.team.author} />
              <div className="min-w-0">
                <h3 className="text-h4 text-fg">{copy.team.author.name}</h3>
                <p className="mt-1 text-small font-medium text-primary">{copy.team.author.role}</p>
                <div className="mt-3 space-y-2 text-body leading-relaxed text-fg-soft">
                  {copy.team.author.bio.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <p className="mt-4 text-body">
                  <Link href={copy.team.href} className={linkCls}>
                    {copy.team.linkLabel}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </Section>
      )}

      {copy.company && (
        <Section labelledBy="about-company" tone="surface">
          <div className="mx-auto max-w-3xl">
            <h2 id="about-company" className="text-h2 text-fg">
              {copy.company.title}
            </h2>
            <p className="mt-5 text-lead text-fg-soft">{copy.company.intro}</p>
            <dl className="mt-6 divide-y divide-border rounded-2xl border border-border bg-bg">
              {copy.company.rows
                .filter((row) => row.value.trim() !== "")
                .map((row) => (
                  <div key={row.label} className="grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[12rem_1fr] sm:gap-4">
                    <dt className="text-small font-semibold text-fg">{row.label}</dt>
                    <dd className="break-words text-body text-fg-soft">
                      {row.href ? (
                        <a href={row.href} className={linkCls}>
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </Section>
      )}

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

/** Round photo when the author has one (Author.photo in src/lib/authors.ts), otherwise their initials. */
function AuthorAvatar({ author }: { author: Author }) {
  if (author.photo) {
    return (
      <Image
        src={author.photo}
        alt={author.name}
        width={96}
        height={96}
        className="size-24 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex size-24 shrink-0 items-center justify-center rounded-full bg-primary-soft text-2xl font-semibold text-primary-soft-fg"
    >
      {authorInitials(author.name)}
    </span>
  );
}
