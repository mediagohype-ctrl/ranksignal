import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Mail } from "lucide-react";
import { RiskBadge } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { PageHero, Prose } from "@/components/marketing/ui";
import { RISK_CLASSES } from "@/components/marketing/content";

export const metadata: Metadata = {
  title: { absolute: `Getting started — ${BRAND.name} Docs` },
  description: `Set up ${BRAND.name}: getting started, connecting WordPress, GitHub and other platforms, how approvals work, reading your numbers, white-label branding and known limits.`,
  alternates: { canonical: "/docs" },
};

const TOC = [
  { id: "onboarding", label: "Getting started" },
  { id: "wordpress", label: "Connect WordPress" },
  { id: "git", label: "GitHub and other platforms" },
  { id: "approval-policy", label: "What needs your OK" },
  { id: "reading-metrics", label: "Reading your numbers" },
  { id: "offsite", label: "Outside your website" },
  { id: "branding", label: "White-label branding" },
  { id: "limitations", label: "Known limits" },
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
              <h2 id="onboarding-h">Getting started</h2>
              <ol>
                <li>
                  <Link href="/signup">Create an account</Link>. Your free trial starts straight away.
                </li>
                <li>
                  <strong>Add your website</strong>: type the address, your business name (plus other names people
                  use for you and your products) and the country and language you sell in.
                </li>
                <li>
                  <strong>Add competitors</strong> you want to compare with. You can add or remove them later.
                </li>
                <li>
                  <strong>Check your customer questions.</strong> We suggest questions based on your website; keep the
                  ones your customers really ask, and add your own.
                </li>
                <li>
                  <strong>Run your first website check and AI check.</strong> Results appear as each one finishes;
                  bigger websites and more questions take longer.
                </li>
              </ol>
              <p>
                Until you connect your website, {BRAND.name} only reads: it reads your public pages and asks AI
                assistants your questions. You can copy every fix and make the change by hand.
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
                  In {BRAND.name}, open your website → <em>Connect website</em> → <em>WordPress</em>, and enter your site
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
              <h2 id="git-h">Connect GitHub and other platforms</h2>
              <p>
                <strong>GitHub:</strong> for static or framework-based sites, connect a repository and {BRAND.name} will
                propose approved changes as <strong>pull requests</strong>. Your existing code review and CI decide
                whether they merge. Use a token scoped to the single repository with the minimum permissions needed to
                open pull requests.
              </p>
              <p>
                <strong>Shopify, Webflow, Contentful, Sanity and Wix:</strong> connect from your project&apos;s{" "}
                <em>Connect website</em> page with an API token for that platform. We write drafts and Google headlines
                and summaries where each platform&apos;s API allows it; what each connector can and can&apos;t
                do is shown before you connect it.
              </p>
              <p>
                <strong>Everything else:</strong> export any approved fix as copy-ready instructions and apply it by hand.
              </p>
            </section>

            <section id="approval-policy" aria-labelledby="policy-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="policy-h">What needs your OK</h2>
              <p>Every suggested change gets one of four types:</p>
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
                Safe work (website checks, briefs, to-dos) never changes your site, so it runs on its own. Owners can
                let certain small edits you can undo (on less important pages) go live without asking each time. This is
                off by default. Advice-only changes are never made by us, whatever the settings.
              </p>
              <h3>Undo and the stop switch</h3>
              <p>
                We save the page before each change we make on your connected website; undo it from the change list.
                Fixes you make by hand can&apos;t be undone for you. The stop switch pauses all changes for your account
                at once (email support and we&apos;ll switch it on); waiting changes stay paused until it is turned off.
                Every OK, change, undo and password change is recorded in your history.
              </p>
            </section>

            <section id="reading-metrics" aria-labelledby="metrics-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="metrics-h">Reading your numbers</h2>
              <ul>
                <li>
                  <strong>Named in X of Y answers</strong> — how many of the AI answers we collected name your business.
                </li>
                <li>
                  <strong>Linked to your site</strong> — how many answers link to one of your pages.
                </li>
                <li>
                  <strong>AI mentions score</strong> — one number from 0 to 100 that sums up how often you&apos;re named,
                  linked and recommended.
                </li>
                <li>
                  <strong>You vs competitors</strong> — how often you&apos;re named compared with the competitors you
                  chose.
                </li>
              </ul>
              <p>
                Every number shows how many answers it is based on. Small numbers jump around — a change of a few points
                from a few answers isn&apos;t a trend yet.
              </p>
            </section>

            <section id="offsite" aria-labelledby="offsite-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="offsite-h">Outside your website</h2>
              <p>
                AI assistants also learn about you from other sites: directories, review platforms, press, forums and
                company profiles. Open your website → <em>Outside your website</em> to track that work through{" "}
                <strong>To do → Submitted → Live</strong> (or Rejected), and note whether each listing&apos;s name, address
                and phone match your website.
              </p>
              <p>
                <strong>Suggestions</strong> come from two places: other websites that AI linked to in your latest AI
                check that aren&apos;t in your list yet, and a starter list of common Indian listings (Google Business
                Profile, Justdial, IndiaMART, Sulekha, Bing Places, Apple Business Connect, LinkedIn, Crunchbase, G2,
                Capterra, Trustpilot). They are places worth considering, not a promise that AI will link to a listing.
              </p>
            </section>

            <section id="branding" aria-labelledby="branding-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="branding-h">White-label branding</h2>
              <p>
                On the Agency plan (and for done-for-you clients), Owners and Admins can open{" "}
                <em>Settings → Branding</em> to set the name, logo (an https:// image link), accent colour, reply-to
                email and a short footer line used on shared report links, monthly reports and monthly report emails. A
                live preview shows the report header and email before you save.
              </p>
              <p>
                Accent colours must be dark enough to read on white. Agency plans can also hide the &ldquo;Powered by{" "}
                {BRAND.name}&rdquo; line.
              </p>
            </section>

            <section id="limitations" aria-labelledby="limits-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="limits-h">Known limits</h2>
              <ul>
                <li>
                  AI answers change from one try to the next and from person to person. Our answers come close to,
                  but can&apos;t exactly match, what any one person sees.
                </li>
                <li>
                  AI companies change their assistants without notice, which can move your numbers even when you
                  changed nothing.
                </li>
                <li>
                  We ask some AI assistants through their developer access rather than their apps, and those answers
                  can differ from what you see in the app.
                </li>
                <li>
                  We report what changed after a fix, not proof that the fix caused it. No plan promises a Google
                  position, AI mentions or links.
                </li>
                <li>
                  Website checks follow your site&apos;s robot rules file and your plan&apos;s page limit. Pages behind a
                  login, or built mostly in the browser, may only be partly checked.
                </li>
                <li>
                  We can publish to WordPress, GitHub, Shopify, Webflow, Contentful, Sanity and Wix, each limited to
                  what that platform allows. For other websites, copy the fix and make the change by hand.
                </li>
                <li>
                  Each website is checked for one country and language. To check another country, add it as a separate
                  website.
                </li>
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
