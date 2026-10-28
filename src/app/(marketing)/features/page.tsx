import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { FinalCta, IconTile, PageHero } from "@/components/marketing/ui";
import { FEATURES } from "@/components/marketing/content";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Prompt research, AI visibility and citation tracking, competitor share, technical and AI-readiness audits, evidence-backed recommendations and approval-gated publishing.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Every feature, explained"
        intro={
          <p>
            {BRAND.name} connects research, measurement, site checks and safe publishing in one loop. Here&apos;s what
            each part does — and what it deliberately doesn&apos;t.
          </p>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <LinkButton href="/signup" size="lg" variant="accent" iconRight={<ArrowRight />}>
            Get your free AI visibility report
          </LinkButton>
          <LinkButton href="/#sample" size="lg" variant="secondary">
            See a sample report
          </LinkButton>
        </div>
      </PageHero>

      <div className="bg-bg py-16 sm:py-20">
        <div className="container-marketing grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-14">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-caption uppercase tracking-[0.06em] text-muted">On this page</p>
              <ul className="mt-3 space-y-0.5 border-l border-border">
                {FEATURES.map((f) => (
                  <li key={f.slug}>
                    <a
                      href={`#${f.slug}`}
                      className="-ml-px block border-l border-transparent py-1.5 pl-4 text-small text-muted transition-colors hover:border-primary hover:text-fg"
                    >
                      {f.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="space-y-6">
            {FEATURES.map((f, i) => (
              <section
                key={f.slug}
                id={f.slug}
                aria-labelledby={`${f.slug}-title`}
                className="scroll-mt-24 rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8"
              >
                <div className="flex items-start gap-4">
                  <IconTile>
                    <f.icon />
                  </IconTile>
                  <div className="min-w-0">
                    <p className="eyebrow">Feature {String(i + 1).padStart(2, "0")}</p>
                    <h2 id={`${f.slug}-title`} className="mt-1 text-h3 text-fg">
                      {f.title}
                    </h2>
                  </div>
                </div>
                <p className="mt-4 text-lead text-fg-soft">{f.summary}</p>
                <ul className="mt-6 space-y-3 border-t border-border pt-6">
                  {f.details.map((d) => (
                    <li key={d} className="flex gap-3 text-body leading-relaxed text-fg-soft">
                      <Check aria-hidden size={18} className="mt-1 shrink-0 text-success" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="pt-2 text-small text-muted">
              Want the step-by-step flow? Read{" "}
              <Link href="/how-it-works" className="font-medium text-primary underline-offset-4 hover:underline">
                how it works
              </Link>{" "}
              or the{" "}
              <Link href="/docs" className="font-medium text-primary underline-offset-4 hover:underline">
                getting-started guide
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      <FinalCta
        title="Put every feature to work on your site"
        body={<p>All features are available during the free trial, within the trial&apos;s usage limits.</p>}
      />
    </>
  );
}
