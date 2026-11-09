// SEO command centre for the SEO / marketing teams:
//  - "Our website": set-up checklist, live SEO/AEO/GEO self-check, IndexNow, every public page with test-tool links.
//  - "Customer SEO health": every customer project's latest scores, biggest drops, most common open problems.
//  - "Growth leads": what our site and free tools bring in.
import Link from "next/link";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { requireStaffPage } from "@/lib/admin/guard";
import { averages, customerSeoHealth, growthLeads, ownSiteSetup, seoToolLinks, topOpenIssues, type ProjectHealth } from "@/lib/admin/seo";
import { MARKETING_ROUTES, siteBase } from "@/lib/free-check/site-seo";
import { ARTICLES } from "@/lib/learn/articles";
import { indexNowKey } from "@/lib/seo/indexnow";
import { fmtAgo, oneOf, str, type SearchParams } from "@/lib/admin/params";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, SeverityBadge, Stat, Table, TD, TH, THead, TR, type Tone } from "@/components/ui";
import { LinkTabs } from "@/components/admin/ui";
import { IndexNowButton, SelfCheckPanel } from "@/components/admin/seo-tools";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO command centre" };

const TABS = ["site", "customers", "growth"] as const;

const scoreTone = (s: number | null | undefined): Tone => (typeof s !== "number" ? "neutral" : s >= 75 ? "success" : s >= 50 ? "warning" : "danger");
const Score = ({ v }: { v: number | null | undefined }) => <Badge tone={scoreTone(v)}>{typeof v === "number" ? v : "—"}</Badge>;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

export default async function SeoCentre({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaffPage("seo.view");
  const sp = await searchParams;
  const tab = oneOf(sp, "tab", TABS, "site");

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO command centre"
        description="Our own SEO, AEO and GEO, every customer's SEO health, and the leads our content brings in."
      />
      <LinkTabs
        label="SEO sections"
        basePath="/admin/seo"
        sp={{}}
        active={tab}
        tabs={[
          { id: "site", label: "Our website" },
          { id: "customers", label: "Customer SEO health" },
          { id: "growth", label: "Growth leads" },
        ]}
      />
      {tab === "site" && <OurSite canManage={staff.can("seo.manage")} />}
      {tab === "customers" && <Customers sort={str(sp, "sort") ?? "worst"} canOpenCustomers={staff.can("customers.view")} />}
      {tab === "growth" && <Growth canOpenLeads={staff.can("leads.view")} />}
    </div>
  );
}

/* ------------------------------------------------------------------ our website */

function OurSite({ canManage }: { canManage: boolean }) {
  const base = siteBase();
  const setup = ownSiteSetup();
  const done = setup.filter((s) => s.ok).length;
  const home = seoToolLinks(`${base}/`);
  const quick = [
    { label: "robots.txt", href: `${base}/robots.txt` },
    { label: "sitemap.xml", href: `${base}/sitemap.xml` },
    { label: "llms.txt", href: `${base}/llms.txt` },
    { label: "llms-full.txt", href: `${base}/llms-full.txt` },
    { label: "Google Search Console", href: "https://search.google.com/search-console" },
    { label: "Bing Webmaster Tools", href: "https://www.bing.com/webmasters" },
    { label: "Rich Results Test (home)", href: home.richResults },
    { label: "PageSpeed (home)", href: home.pageSpeed },
    { label: "Schema validator (home)", href: home.schemaValidator },
    { label: "Pages Google has indexed", href: home.googleIndex },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Set-up complete" value={`${done} / ${setup.length}`} hint="Search engine and AI set-up" />
        <Stat label="Public pages in sitemap" value={MARKETING_ROUTES.length} />
        <Stat label="Guides published" value={ARTICLES.length} hint="/learn" />
        <Stat label="Last guide update" value={ARTICLES.map((a) => a.updated).sort().at(-1) ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Search engine & AI set-up" description="Each item is read from the server's settings." />
          <CardBody>
            <ul className="space-y-3">
              {setup.map((s) => (
                <li key={s.label} className="flex gap-3 text-small">
                  {s.ok ? (
                    <CheckCircle2 aria-label="Done" className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle aria-label="Missing" className="mt-0.5 size-4 shrink-0 text-danger" />
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium text-fg">{s.label}</span>
                    <span className="block break-words text-xs text-muted">{s.detail}</span>
                    {!s.ok && s.fix && <span className="mt-1 block text-xs text-fg-soft">Fix: {s.fix}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Quick links" description="Our SEO and AI files, and the tools to test them." />
          <CardBody className="space-y-5">
            <ul className="grid gap-2 sm:grid-cols-2">
              {quick.map((q) => (
                <li key={q.label}>
                  <a href={q.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-small text-primary hover:underline">
                    {q.label} <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
            {canManage && <IndexNowButton configured={indexNowKey() !== null} />}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Live check" description="Runs the same SEO / AEO / GEO check as our free tool, on any public page. Not saved as a lead." />
        <CardBody>
          <SelfCheckPanel defaultUrl={`${base}/`} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Every public page"
          description="What's in the sitemap and llms.txt. Edit titles in the page files; edit guides in src/lib/learn/articles.ts."
        />
        <div className="overflow-x-auto">
          <Table caption="Public pages" density="compact" zebra>
            <THead>
              <TR>
                <TH>Page</TH>
                <TH>Group</TH>
                <TH align="right">Priority</TH>
                <TH>Updated</TH>
                <TH>Test</TH>
              </TR>
            </THead>
            <tbody>
              {MARKETING_ROUTES.map((r) => {
                const url = r.path === "/" ? `${base}/` : `${base}${r.path}`;
                const t = seoToolLinks(url);
                return (
                  <TR key={r.path}>
                    <TD>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-fg hover:underline">
                        {r.title}
                      </a>
                      <span className="block text-xs text-muted">{r.path}</span>
                    </TD>
                    <TD>{r.section}</TD>
                    <TD align="right">{r.priority}</TD>
                    <TD>{r.updated ?? "—"}</TD>
                    <TD>
                      <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <a className="text-primary hover:underline" href={t.richResults} target="_blank" rel="noopener noreferrer">
                          Rich results
                        </a>
                        <a className="text-primary hover:underline" href={t.pageSpeed} target="_blank" rel="noopener noreferrer">
                          Speed
                        </a>
                        <a className="text-primary hover:underline" href={t.googleIndex} target="_blank" rel="noopener noreferrer">
                          Indexed?
                        </a>
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ customers */

async function Customers({ sort, canOpenCustomers }: { sort: string; canOpenCustomers: boolean }) {
  const [rows, issues] = await Promise.all([customerSeoHealth(), topOpenIssues()]);
  if (rows.length === 0) {
    return <EmptyState title="No customer website checks yet" description="Scores appear here after the first website check of a customer project." />;
  }
  const avg = averages(rows);
  const sorters: Record<string, (a: ProjectHealth, b: ProjectHealth) => number> = {
    worst: (a, b) => (a.overall ?? 101) - (b.overall ?? 101),
    best: (a, b) => (b.overall ?? -1) - (a.overall ?? -1),
    drops: (a, b) => (a.change ?? 0) - (b.change ?? 0),
    urgent: (a, b) => (b.urgentIssues ?? 0) - (a.urgentIssues ?? 0),
    stale: (a, b) => a.checkedAt.getTime() - b.checkedAt.getTime(),
  };
  const sorted = [...rows].sort(sorters[sort] ?? sorters.worst).slice(0, 100);
  const dropped = rows.filter((r) => (r.change ?? 0) <= -5).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Projects checked" value={rows.length} />
        <Stat label="Avg overall" value={avg.overall ?? "—"} />
        <Stat label="Avg SEO" value={avg.seo ?? "—"} />
        <Stat label="Avg AEO" value={avg.aeo ?? "—"} />
        <Stat label="Avg GEO" value={avg.geo ?? "—"} />
        <Stat label="Dropped 5+ points" value={dropped} hint={`Avg AI mention rate ${pct(avg.mentionRate)}`} />
      </div>

      <Card>
        <CardHeader
          title="Projects"
          description="Latest website check per project (top 100 for this view)."
          actions={
            <span className="flex flex-wrap gap-2 text-xs">
              {[
                ["worst", "Lowest score"],
                ["drops", "Biggest drops"],
                ["urgent", "Most urgent issues"],
                ["stale", "Not checked lately"],
                ["best", "Highest score"],
              ].map(([id, label]) => (
                <Link
                  key={id}
                  href={`/admin/seo?tab=customers&sort=${id}`}
                  className={sort === id ? "font-semibold text-primary" : "text-fg-soft hover:text-fg"}
                >
                  {label}
                </Link>
              ))}
            </span>
          }
        />
        <div className="overflow-x-auto">
          <Table caption="Customer SEO health" density="compact" zebra>
            <THead>
              <TR>
                <TH>Project</TH>
                <TH align="center">Overall</TH>
                <TH align="center">Change</TH>
                <TH align="center">SEO</TH>
                <TH align="center">AEO</TH>
                <TH align="center">GEO</TH>
                <TH align="center">Brand</TH>
                <TH align="right">Open / urgent</TH>
                <TH align="right">AI mentions</TH>
                <TH>Checked</TH>
              </TR>
            </THead>
            <tbody>
              {sorted.map((r) => (
                <TR key={r.projectId}>
                  <TD>
                    {canOpenCustomers ? (
                      <Link href={`/admin/customers/${r.organizationId}?tab=projects`} className="font-medium text-fg hover:underline">
                        {r.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-fg">{r.name}</span>
                    )}
                    <span className="block max-w-[18rem] truncate text-xs text-muted">
                      {r.orgName} · {r.websiteUrl}
                    </span>
                  </TD>
                  <TD align="center"><Score v={r.overall} /></TD>
                  <TD align="center">
                    {r.change === null ? "—" : <span className={r.change < 0 ? "text-danger" : r.change > 0 ? "text-success" : "text-muted"}>{r.change > 0 ? `+${r.change}` : r.change}</span>}
                  </TD>
                  <TD align="center"><Score v={r.pillars.seo} /></TD>
                  <TD align="center"><Score v={r.pillars.aeo} /></TD>
                  <TD align="center"><Score v={r.pillars.geo} /></TD>
                  <TD align="center"><Score v={r.pillars.brand} /></TD>
                  <TD align="right">
                    {r.openIssues ?? "—"} / <span className={(r.urgentIssues ?? 0) > 0 ? "font-semibold text-danger" : ""}>{r.urgentIssues ?? 0}</span>
                  </TD>
                  <TD align="right">{pct(r.mentionRate)}</TD>
                  <TD>{fmtAgo(r.checkedAt)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Most common open problems" description="Across all customers. Build a playbook or an automatic fix for the top ones." />
        {issues.length === 0 ? (
          <CardBody>
            <p className="text-small text-muted">No open problems.</p>
          </CardBody>
        ) : (
          <Table caption="Most common open problems" density="compact" zebra>
            <THead>
              <TR>
                <TH>Problem</TH>
                <TH>Category</TH>
                <TH>Severity</TH>
                <TH align="right">Open on pages</TH>
              </TR>
            </THead>
            <tbody>
              {issues.map((i) => (
                <TR key={`${i.code}-${i.severity}`}>
                  <TD>
                    <code className="text-xs">{i.code}</code>
                  </TD>
                  <TD>{i.category.replace(/_/g, " ")}</TD>
                  <TD><SeverityBadge severity={i.severity} /></TD>
                  <TD align="right">{i.count.toLocaleString("en-IN")}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ growth */

const SOURCE_LABEL: Record<string, string> = {
  free_check: "Free website check",
  contact: "Contact form",
  signup_intent: "Started sign-up",
  "tool:ai-mention-checker": "AI visibility checker",
  "tool:faq-markup-maker": "FAQ schema generator",
  "tool:ai-guide-file-maker": "llms.txt generator",
};

async function Growth({ canOpenLeads }: { canOpenLeads: boolean }) {
  const g = await growthLeads(30);
  const converted = g.byStatus.converted ?? 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leads (30 days)" value={g.total} />
        <Stat label="Left an email" value={g.withEmail} hint={g.total ? `${Math.round((g.withEmail / g.total) * 100)}% of leads` : undefined} />
        <Stat label="Qualified" value={g.byStatus.qualified ?? 0} />
        <Stat label="Converted" value={converted} />
      </div>
      <Card>
        <CardHeader
          title="Where leads come from (30 days)"
          description="Free tools and guides exist to bring these in. Compare with Search Console clicks to see which pages earn leads."
          actions={
            canOpenLeads ? (
              <Link href="/admin/leads" className="text-small font-medium text-primary hover:underline">
                Open leads →
              </Link>
            ) : undefined
          }
        />
        {g.bySource.length === 0 ? (
          <CardBody>
            <p className="text-small text-muted">No leads in the last 30 days.</p>
          </CardBody>
        ) : (
          <Table caption="Leads by source" density="compact" zebra>
            <THead>
              <TR>
                <TH>Source</TH>
                <TH align="right">Leads</TH>
                <TH align="right">Share</TH>
              </TR>
            </THead>
            <tbody>
              {g.bySource.map((s) => (
                <TR key={s.source}>
                  <TD>{SOURCE_LABEL[s.source] ?? s.source}</TD>
                  <TD align="right">{s.count}</TD>
                  <TD align="right">{g.total ? `${Math.round((s.count / g.total) * 100)}%` : "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
