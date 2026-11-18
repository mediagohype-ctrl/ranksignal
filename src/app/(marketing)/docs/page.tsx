import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Mail } from "lucide-react";
import { RiskBadge } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Prose } from "@/components/marketing/ui";
import { RISK_CLASSES } from "@/components/marketing/content";
import { CUSTOM_PLAN, DFY_PLAN, SELF_PLAN, TRIAL_AI, TRIAL_DAYS, engineNamesLine, freq, num } from "@/components/marketing/plans";
import { SELF_FIX_LINE } from "@/lib/billing/offer";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, webPageLd } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/docs");

const TOC = [
  { id: "onboarding", label: "Getting started" },
  { id: "fixes", label: "How fixes work" },
  { id: "schedules", label: "Checks that run on their own" },
  { id: "method", label: "How we measure" },
  { id: "reading-metrics", label: "Reading your numbers" },
  { id: "wordpress", label: "Connect WordPress" },
  { id: "git", label: "GitHub and other platforms" },
  { id: "approval-policy", label: "What needs your OK" },
  { id: "offsite", label: "Outside your website" },
  { id: "branding", label: "White-label branding" },
  { id: "limitations", label: "Known limits" },
];

export default function DocsPage() {
  return (
    <>
      <JsonLd data={[webPageLd("/docs", { name: "Getting started guide" }), breadcrumbLd([{ name: "Docs", path: "/docs" }])]} />
      <PageHero
        eyebrow="Docs"
        title="Getting started guide"
        intro={<p>Everything you need to go from sign-up to your first fix.</p>}
      />
      <div className="bg-bg py-12 sm:py-16">
        <div className="container-marketing grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr] lg:gap-12">
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
                {BRAND.name} only reads: it reads your public pages and asks AI assistants your questions. On{" "}
                {SELF_PLAN.name} it never changes your website. You copy each fix and make the change yourself.
              </p>
              <p>
                The free trial lasts {TRIAL_DAYS} days and includes {TRIAL_AI.summary} ({TRIAL_AI.answers} AI answers) plus
                a full website check. On {SELF_PLAN.name}, each website check reads up to{" "}
                {num(SELF_PLAN.limits.maxPagesPerCrawl)} pages. Bigger sites can ask about a {CUSTOM_PLAN.name} plan.
              </p>
            </section>

            <section id="fixes" aria-labelledby="fixes-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="fixes-h">How fixes work</h2>
              <ul>
                <li>
                  <strong>{SELF_PLAN.name}:</strong> we show exactly what to change, and you make the change.{" "}
                  {SELF_FIX_LINE}. Nothing on your website changes automatically, and there is nothing to connect.
                  When a fix is done, mark it done; the next website check confirms it.
                </li>
                <li>
                  <strong>{DFY_PLAN.name}:</strong> our team makes the changes on your website, and asks for your OK
                  first.
                </li>
                <li>
                  <strong>{CUSTOM_PLAN.name}:</strong> works like {DFY_PLAN.name}, for many websites or brands.
                </li>
              </ul>
              <p>
                The sections on connecting a website and on what needs your OK, further down, apply to {DFY_PLAN.name}{" "}
                and {CUSTOM_PLAN.name} only.
              </p>
            </section>

            <section id="schedules" aria-labelledby="schedules-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="schedules-h">Checks that run on their own</h2>
              <ul>
                <li>
                  <strong>Website check:</strong> on {SELF_PLAN.name} we read your website again{" "}
                  {freq(SELF_PLAN.limits.minScanIntervalDays).toLowerCase()}, up to{" "}
                  {num(SELF_PLAN.limits.maxPagesPerCrawl)} pages each time, so new problems show up and fixed ones drop off.
                </li>
                <li>
                  <strong>AI check:</strong> {SELF_PLAN.name} includes {SELF_PLAN.ai.checksPerMonth} AI checks a month.
                  Each one asks {engineNamesLine(SELF_PLAN.id)} up to {SELF_PLAN.ai.questionsPerCheck} of your customer
                  questions ({num(SELF_PLAN.ai.answersPerMonth)} AI answers a month in all).
                </li>
                <li>
                  <strong>Emails:</strong> when a website check or AI check is done, Owners and Admins get an email with the
                  main result and a link. You can turn these off for each website.
                </li>
                <li>
                  <strong>Monthly report:</strong> early each month, last month&apos;s report is emailed to you and opens
                  as a page you can save as a PDF.
                </li>
                <li>
                  <strong>Score history:</strong> every result is kept. &ldquo;Since last time&rdquo; compares only the
                  questions asked both times, and shows when the question list or our method changed.
                </li>
              </ul>
            </section>

            <section id="method" aria-labelledby="method-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="method-h">How we measure</h2>
              <h3>How the website check reads your pages</h3>
              <p>
                Like a search engine. We start at your homepage and sitemap, follow your internal links and obey your
                robots.txt rules, as set out in the{" "}
                <a href="https://datatracker.ietf.org/doc/html/rfc9309" rel="noopener">
                  Robots Exclusion Protocol
                </a>
                . We read gently and never overload your website.
              </p>
              <h3>How the scores are worked out</h3>
              <p>
                Every check belongs to one of four areas: SEO, AEO, GEO or Brand. Each area gets a score from 0 to 100,
                based on how many of your pages pass each check and how much that check matters. A check we could not
                measure is marked as not measured, never guessed.
              </p>
              <h3>How we measure what AI assistants say about you</h3>
              <p>
                We ask each AI assistant on your plan your customers&apos; real questions and record whether the answer
                names you, links to you or names a competitor instead. Every number shows how many answers it is based
                on. We report what changed after a fix, never proof that the fix caused it.
              </p>
            </section>

            <section id="wordpress" aria-labelledby="wordpress-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="wordpress-h">Connect WordPress (application password)</h2>
              <p>
                <strong>
                  {DFY_PLAN.name} and {CUSTOM_PLAN.name} only.
                </strong>{" "}
                Connecting a website lets our team make the changes you have agreed. {SELF_PLAN.name} has no website
                connections.
              </p>
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
                <strong>
                  {DFY_PLAN.name} and {CUSTOM_PLAN.name} only.
                </strong>
              </p>
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
                <strong>Everything else:</strong> our team works from copy-ready instructions and makes the change by hand,
                or sends it to the person who looks after your website.
              </p>
            </section>

            <section id="approval-policy" aria-labelledby="policy-h" className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10">
              <h2 id="policy-h">What needs your OK</h2>
              <p>
                This applies to {DFY_PLAN.name} and {CUSTOM_PLAN.name}, where our team makes changes on your website.
                On {SELF_PLAN.name} nothing changes your website automatically, so there is nothing to approve.
              </p>
              <p>Every change our team prepares gets one of four types:</p>
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
                We save the page before each change our team makes on your connected website, so it can be undone from
                the change list. Fixes you make by hand can&apos;t be undone for you. The stop switch pauses all changes for your account
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
                On a {CUSTOM_PLAN.name} plan (and for {DFY_PLAN.name} clients), Owners and Admins can open{" "}
                <em>Settings → Branding</em> to set the name, logo (an https:// image link), accent colour, reply-to
                email and a short footer line used on shared report links, monthly reports and monthly report emails. A
                live preview shows the report header and email before you save.
              </p>
              <p>
                Accent colours must be dark enough to read on white. {CUSTOM_PLAN.name} plans can also hide the &ldquo;Powered by{" "}
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
                  Website checks follow your site&apos;s robot rules file (robots.txt, as defined in{" "}
                  <a href="https://datatracker.ietf.org/doc/html/rfc9309" rel="noopener">
                    RFC 9309
                  </a>
                  ) and your plan&apos;s page limit. Pages behind a login, or built mostly in the browser, may only be partly
                  checked; Google explains why in its guide to{" "}
                  <a href="https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics" rel="noopener">
                    JavaScript SEO basics
                  </a>
                  .
                </li>
                <li>
                  On {DFY_PLAN.name} and {CUSTOM_PLAN.name}, our team can publish to WordPress, GitHub, Shopify, Webflow,
                  Contentful, Sanity and Wix, each limited to what that platform allows. On {SELF_PLAN.name}, and for
                  other websites, you copy the fix and make the change by hand.
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
