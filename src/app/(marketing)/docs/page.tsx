import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Mail } from "lucide-react";
import { RiskBadge } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { PageHero, Prose } from "@/components/marketing/ui";
import { RISK_CLASSES } from "@/components/marketing/content";

export const metadata: Metadata = {
  title: { absolute: `Getting started — ${BRAND.name} Docs` },
  description: `Set up ${BRAND.name}: onboarding, connecting WordPress with an application password, how the approval policy works, and known limitations.`,
  alternates: { canonical: "/docs" },
};

const TOC = [
  { id: "onboarding", label: "Onboarding" },
  { id: "wordpress", label: "Connect WordPress" },
  { id: "git", label: "Connect a Git repository" },
  { id: "approval-policy", label: "Approval policy" },
  { id: "reading-metrics", label: "Reading the metrics" },
  { id: "limitations", label: "Known limitations" },
];

export default function DocsPage() {
  return (
    <>
      <PageHero
        eyebrow="Docs"
        title="Getting started guide"
        intro={<p>Everything you need to go from sign-up to your first approved fix.</p>}
      />
      <div className="bg-bg py-12 sm:py-16">
        <div className="container-marketing grid gap-8 lg:grid-cols-[240px_1fr] lg:gap-12">
          <nav aria-label="Guide contents" className="lg:order-none">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-card lg:sticky lg:top-24 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
              <p className="flex items-center gap-2 text-caption uppercase tracking-[0.06em] text-muted">
                <BookOpen aria-hidden size={14} />
                On this page
              </p>
              <ol className="mt-3 space-y-0.5 lg:border-l lg:border-border">
                {TOC.map((t, i) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      className="flex gap-2 rounded-md py-1.5 text-small text-muted transition-colors hover:text-fg lg:-ml-px lg:rounded-none lg:border-l lg:border-transparent lg:pl-4 lg:hover:border-primary"
                    >
                      <span className="tabular-nums text-muted">{i + 1}.</span>
                      {t.label}
                    </a>
                  </li>
                ))}
              </ol>
              <div className="mt-6 hidden rounded-xl bg-surface-2 p-4 lg:block">
                <p className="text-small font-semibold text-fg">Need a hand?</p>
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-small text-primary underline-offset-4 hover:underline"
                >
                  <Mail aria-hidden size={14} />
                  Email support
                </a>
              </div>
            </div>
          </nav>

          <article className="min-w-0 rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-10">
            <Prose>
            <section id="onboarding" aria-labelledby="onboarding-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="onboarding-h">Onboarding</h2>
              <ol>
                <li>
                  <Link href="/signup">Create an account</Link> and a workspace. Your free trial starts immediately.
                </li>
                <li>
                  <strong>Create a project</strong> for your site: enter the domain, your brand name (plus common
                  variants and product names) and the countries and languages you want to track.
                </li>
                <li>
                  <strong>Add competitors</strong> you want to benchmark against. You can add or remove them later.
                </li>
                <li>
                  <strong>Review your prompts.</strong> We suggest prompts based on your site and category; keep the ones
                  that reflect how real buyers ask, and add your own.
                </li>
                <li>
                  <strong>Run your first audit and visibility scan.</strong> Results appear as jobs complete; larger
                  sites and prompt sets take longer.
                </li>
              </ol>
              <p>
                Until you connect a CMS, {BRAND.name} is read-only: it crawls public pages and queries answer engines,
                and every fix can be exported for manual application.
              </p>
            </section>

            <section id="wordpress" aria-labelledby="wordpress-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="wordpress-h">Connect WordPress (application password)</h2>
              <p>
                WordPress application passwords let {BRAND.name} use the REST API without ever knowing your real login
                password, and you can revoke them at any time.
              </p>
              <ol>
                <li>
                  In WordPress admin, create (or choose) a user with the <strong>Editor</strong> role. Avoid using an
                  Administrator account — least privilege is safer.
                </li>
                <li>
                  Go to <em>Users → Profile</em>, scroll to <strong>Application Passwords</strong>, enter a name such as
                  <code>{BRAND.name}</code> and click <em>Add New Application Password</em>.
                </li>
                <li>Copy the generated password. WordPress shows it only once.</li>
                <li>
                  In {BRAND.name}, open your project → <em>Integrations</em> → <em>WordPress</em>, and enter your site
                  URL, the WordPress username and the application password.
                </li>
                <li>
                  Click <strong>Test connection</strong>. We verify access with a read-only request before saving.
                </li>
              </ol>
              <p>
                Credentials are encrypted at rest and never shown again in the app. Your site must be served over HTTPS
                and the REST API must be reachable (some security plugins block it). To disconnect, delete the
                integration in {BRAND.name} and revoke the application password in WordPress.
              </p>
            </section>

            <section id="git" aria-labelledby="git-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="git-h">Connect a Git repository</h2>
              <p>
                For static or framework-based sites, connect a repository and {BRAND.name} will propose approved changes
                as <strong>pull requests</strong>. Your existing code review and CI decide whether they merge. Use a
                token scoped to the single repository with the minimum permissions needed to open pull requests.
              </p>
            </section>

            <section id="approval-policy" aria-labelledby="policy-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="policy-h">Approval policy explained</h2>
              <p>Every recommended change is assigned a risk class:</p>
              <ul className="!list-none space-y-3 !pl-0">
                {RISK_CLASSES.map((r) => (
                  <li key={r.cls} className="flex flex-col items-start gap-2 rounded-xl bg-surface-2 p-4 !pl-4 sm:flex-row sm:gap-3">
                    <RiskBadge riskClass={r.cls} className="shrink-0" />
                    <span>
                      <strong>{r.name}.</strong> {r.body}
                    </span>
                  </li>
                ))}
              </ul>
              <h3>Exact-draft approvals</h3>
              <p>
                When you approve a change, the approval is bound to that exact draft. If anyone edits the draft
                afterwards — including regenerating it — the approval is void and the change must be approved again.
                What ships is always byte-for-byte what was approved.
              </p>
              <h3>Auto-apply (optional)</h3>
              <p>
                Owners can allow class A changes to run without manual approval for a project. This is off by default.
                Class D changes are never executed by the system, whatever the policy.
              </p>
              <h3>Rollback and kill switch</h3>
              <p>
                A snapshot is stored before each change; roll back from the change log. The publishing kill switch
                pauses all executions for your workspace immediately; queued changes wait until it is turned off.
                Approvals, executions, rollbacks and credential changes are recorded in the audit log.
              </p>
            </section>

            <section id="reading-metrics" aria-labelledby="metrics-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="metrics-h">Reading the metrics</h2>
              <ul>
                <li>
                  <strong>Mention rate</strong> — share of sampled answers that mention your brand.
                </li>
                <li>
                  <strong>Citation rate</strong> — share of sampled answers that cite or link one of your URLs.
                </li>
                <li>
                  <strong>Visibility index</strong> — a 0–100 summary combining mention, position and citation signals.
                </li>
                <li>
                  <strong>Share of voice</strong> — your mentions relative to the competitors you track.
                </li>
              </ul>
              <p>
                Every metric shows the number of answers it is based on. Small samples produce wide ranges — treat a
                change of a few points on a small sample as noise, not a trend.
              </p>
            </section>

            <section id="limitations" aria-labelledby="limits-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="limits-h">Known limitations</h2>
              <ul>
                <li>
                  AI answers are non-deterministic and personalised; our samples approximate, but cannot exactly
                  reproduce, what any individual user sees.
                </li>
                <li>
                  Engines change models and sources without notice, which can shift metrics independently of anything
                  you changed.
                </li>
                <li>
                  Some engines are measured through their APIs rather than consumer apps, and API answers can differ
                  from in-app answers.
                </li>
                <li>
                  We report measured changes after a fix, not proof that the fix caused them. No plan guarantees
                  rankings, mentions or citations.
                </li>
                <li>
                  Crawling respects robots.txt and plan page limits; pages behind logins or heavy client-side rendering
                  may be partially audited.
                </li>
                <li>
                  Publishing connectors currently cover WordPress and Git. Other platforms use export-and-apply.
                </li>
                <li>White-label reports are not yet available.</li>
              </ul>
              <p>
                Questions? Email <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
              </p>
            </section>
          </Prose>
          </article>
        </div>
      </div>
    </>
  );
}
