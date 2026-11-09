// Data for the admin SEO command centre: our own site's SEO set-up, customers' SEO health, growth leads.
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { INDEXNOW_KEY_RE } from "@/lib/seo/indexnow";
import { siteBase } from "@/lib/free-check/site-seo";

export interface SetupCheck {
  label: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

/** What's configured for our own SEO / GEO (env-driven, no network). */
export function ownSiteSetup(env: Record<string, string | undefined> = process.env): SetupCheck[] {
  const base = siteBase(env.APP_URL ?? BRAND.appUrl);
  const set = (k: string) => !!(env[k] ?? "").trim();
  const sameAs = (env.BRAND_SAME_AS ?? "").split(",").map((s) => s.trim()).filter((s) => /^https:\/\//.test(s));
  return [
    {
      label: "Public https address (APP_URL)",
      ok: /^https:\/\//.test(base) && !base.includes("localhost"),
      detail: base,
      fix: "Set APP_URL to the live https address — canonical links, sitemap and schema all use it.",
    },
    {
      label: "Google Search Console verified",
      ok: set("GOOGLE_SITE_VERIFICATION"),
      detail: set("GOOGLE_SITE_VERIFICATION") ? "Verification tag is on every page." : "Not set.",
      fix: "Search Console → Add property → HTML tag → paste the content value into GOOGLE_SITE_VERIFICATION.",
    },
    {
      label: "Bing Webmaster Tools verified",
      ok: set("BING_SITE_VERIFICATION"),
      detail: set("BING_SITE_VERIFICATION") ? "msvalidate.01 tag is on every page." : "Not set. Bing feeds ChatGPT search and Copilot.",
      fix: "Bing Webmaster Tools → Add site → HTML meta tag → paste the content value into BING_SITE_VERIFICATION.",
    },
    {
      label: "IndexNow key",
      ok: INDEXNOW_KEY_RE.test((env.INDEXNOW_KEY ?? "").trim()),
      detail: `${base}/indexnow.txt`,
      fix: "Set INDEXNOW_KEY to a random 32-character string, redeploy, then use “Submit to IndexNow”.",
    },
    {
      label: "Official profiles linked (sameAs)",
      ok: sameAs.length >= 2,
      detail: sameAs.length ? `${sameAs.length} profile(s): ${sameAs.map((u) => new URL(u).hostname).join(", ")}` : "None.",
      fix: "List LinkedIn, X, YouTube, Crunchbase, G2 etc. in BRAND_SAME_AS so Google and AI tie them to one brand.",
    },
  ];
}

/** Handy external tools for a URL on our site. */
export function seoToolLinks(url: string) {
  const u = encodeURIComponent(url);
  return {
    richResults: `https://search.google.com/test/rich-results?url=${u}`,
    pageSpeed: `https://pagespeed.web.dev/analysis?url=${u}`,
    schemaValidator: `https://validator.schema.org/#url=${u}`,
    googleIndex: `https://www.google.com/search?q=${encodeURIComponent(`site:${url.replace(/^https?:\/\//, "")}`)}`,
  };
}

type Pillars = { seo?: number | null; aeo?: number | null; geo?: number | null; brand?: number | null };

export interface ProjectHealth {
  projectId: string;
  organizationId: string;
  orgName: string;
  name: string;
  websiteUrl: string;
  overall: number | null;
  change: number | null;
  pillars: Pillars;
  openIssues: number | null;
  urgentIssues: number | null;
  mentionRate: number | null;
  checkedAt: Date;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Latest website-check score per customer project (+ change vs the one before), plus latest AI mention rate. */
export async function customerSeoHealth(limitSnapshots = 3000): Promise<ProjectHealth[]> {
  const [crawls, vis] = await Promise.all([
    db.reportSnapshot.findMany({
      where: { kind: "crawl", simulated: false },
      orderBy: { createdAt: "desc" },
      take: limitSnapshots,
      select: { projectId: true, organizationId: true, overallScore: true, pillarScores: true, openIssues: true, createdAt: true },
    }),
    db.reportSnapshot.findMany({
      where: { kind: "visibility", simulated: false },
      orderBy: { createdAt: "desc" },
      distinct: ["projectId"],
      take: 1000,
      select: { projectId: true, visibility: true },
    }),
  ]);
  const latest = new Map<string, (typeof crawls)[number]>();
  const previous = new Map<string, number | null>();
  for (const s of crawls) {
    if (!latest.has(s.projectId)) latest.set(s.projectId, s);
    else if (!previous.has(s.projectId)) previous.set(s.projectId, s.overallScore);
  }
  const ids = [...latest.keys()];
  const projects = await db.project.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, websiteUrl: true, organizationId: true, organization: { select: { name: true } } },
  });
  const mention = new Map(vis.map((v) => [v.projectId, num((v.visibility as { mentionRate?: unknown } | null)?.mentionRate)]));
  return projects.map((p) => {
    const s = latest.get(p.id)!;
    const issues = (s.openIssues ?? {}) as { total?: unknown; critical?: unknown; high?: unknown };
    const prev = previous.get(p.id);
    return {
      projectId: p.id,
      organizationId: p.organizationId,
      orgName: p.organization.name,
      name: p.name,
      websiteUrl: p.websiteUrl,
      overall: s.overallScore,
      change: s.overallScore !== null && prev !== undefined && prev !== null ? s.overallScore - prev : null,
      pillars: (s.pillarScores ?? {}) as Pillars,
      openIssues: num(issues.total),
      urgentIssues: (num(issues.critical) ?? 0) + (num(issues.high) ?? 0),
      mentionRate: mention.get(p.id) ?? null,
      checkedAt: s.createdAt,
    };
  });
}

export function averages(rows: ProjectHealth[]) {
  const avg = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === "number");
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  return {
    overall: avg(rows.map((r) => r.overall)),
    seo: avg(rows.map((r) => r.pillars.seo)),
    aeo: avg(rows.map((r) => r.pillars.aeo)),
    geo: avg(rows.map((r) => r.pillars.geo)),
    brand: avg(rows.map((r) => r.pillars.brand)),
    mentionRate: (() => {
      const v = rows.map((r) => r.mentionRate).filter((x): x is number => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    })(),
  };
}

/** Most common open problems across all customers — what the SEO team should build playbooks for. */
export async function topOpenIssues(take = 15) {
  const rows = await db.auditFinding.groupBy({
    by: ["code", "category", "severity"],
    where: { status: "open" },
    _count: { _all: true },
    orderBy: { _count: { code: "desc" } },
    take,
  });
  return rows.map((r) => ({ code: r.code, category: r.category, severity: r.severity, count: r._count._all }));
}

/** Leads from our site and free tools over the last `days` days, by source and status. */
export async function growthLeads(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [bySource, byStatus, withEmail, total] = await Promise.all([
    db.lead.groupBy({ by: ["source"], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { source: "desc" } } }),
    db.lead.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.lead.count({ where: { createdAt: { gte: since }, email: { not: null } } }),
    db.lead.count({ where: { createdAt: { gte: since } } }),
  ]);
  return {
    days,
    total,
    withEmail,
    bySource: bySource.map((s) => ({ source: s.source, count: s._count._all })),
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<string, number>,
  };
}
