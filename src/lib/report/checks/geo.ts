// GEO checks: can generative AI tools (ChatGPT, Gemini, Perplexity, Claude…) reach, trust and quote you?
import { isArticleUrl } from "@/lib/audit/page-kind";
import { AI_BOTS } from "@/lib/audit/ai-bots";
import { contentPages } from "@/lib/report/checks/aeo";
import {
  findHome, makeCheck, notMeasured, okPages, pct, plural, targetScore, urlOf, v2Pages, NEEDS_RESCAN,
  type CheckContext, type EvaluatedCheck, type ReportPage,
} from "@/lib/report/inputs";

const P = "geo" as const;
const DAY = 86_400_000;
export const FRESH_DAYS = 365;
const NOT_MEASURED_AI = "AI answers have not been measured yet — run an AI visibility check.";

export function brandShareOf(ctx: CheckContext): { brand: number; topCompetitor: { name: string; share: number } | null } {
  const brandShare = ctx.ai.brandShare ?? 0;
  const top = ctx.ai.topCompetitors[0] ?? null;
  return { brand: brandShare, topCompetitor: top };
}

/** Is this page an article (dated content where authorship matters)? */
export function isArticlePage(p: ReportPage): boolean {
  const x = p.extracted!;
  return isArticleUrl(urlOf(p)) || x.schemaTypes.some((t) => /Article|BlogPosting|NewsArticle/.test(t));
}

export function geoChecks(ctx: CheckContext): EvaluatedCheck[] {
  const ok = okPages(ctx.pages);
  const out: EvaluatedCheck[] = [];
  const v2 = v2Pages(ctx.pages);
  const v2Content = contentPages(v2);
  const home = findHome(ctx);
  const homeUrl = ctx.site?.homepageUrl ?? ctx.websiteUrl;

  if (ok.length > 0) {
    // AI crawler access (robots.txt).
    const bots = ctx.site?.robots.aiBots;
    let blocked: { token: string; purpose: string; label: string }[] = [];
    let checked = 0;
    let robotsKnown = true;
    if (bots) {
      blocked = bots.filter((b) => !b.allowed);
      checked = bots.length;
    } else if (ctx.site) {
      blocked = ctx.site.robots.blockedAiCrawlers.map((t) => AI_BOTS.find((b) => b.token === t) ?? { token: t, purpose: "training", label: t });
      checked = 5;
    } else {
      const f = ctx.findings.find((x) => x.code === "ai_crawler_access");
      const list = ((f?.evidence as { blocked?: unknown } | undefined)?.blocked as string[] | undefined) ?? [];
      blocked = list.filter((t) => typeof t === "string").map((t) => AI_BOTS.find((b) => b.token === t) ?? { token: t, purpose: "training", label: t });
      checked = 5;
      robotsKnown = ctx.findings.length > 0;
    }
    const blocksEveryone = ctx.site?.robots.blocksEveryone === true;
    const searchBlocked = blocked.filter((b) => b.purpose !== "training");
    const trainingBlocked = blocked.filter((b) => b.purpose === "training");
    if (!robotsKnown) {
      out.push(notMeasured(P, "geo.ai_search_access", "AI search tools can read your site", 3, NEEDS_RESCAN));
    } else {
      out.push(makeCheck(P, "geo.ai_search_access", "AI search tools can read your site", 3, {
        score: searchBlocked.length === 0 && !blocksEveryone ? 100 : Math.max(0, 40 - searchBlocked.length * 10),
        detail: searchBlocked.length
          ? `Your robots.txt blocks ${searchBlocked.length} AI search/answer bot${searchBlocked.length === 1 ? "" : "s"}: ${searchBlocked.map((b) => b.token).join(", ")}.`
          : blocksEveryone
            ? "Your robots.txt blocks all crawlers from the whole site."
            : `None of the ${checked} AI crawlers we check are blocked from fetching pages for live answers.`,
        affected: searchBlocked.length ? [homeUrl.replace(/\/?$/, "/robots.txt")] : [],
        evidence: searchBlocked.length ? `Blocked: ${searchBlocked.map((b) => `${b.token} (${b.label})`).join("; ")}` : undefined,
        facts: { searchBlocked: searchBlocked.length, checked, blocksEveryone },
      }));
      out.push(makeCheck(P, "geo.ai_training_access", "AI training crawlers (your choice)", 0.5, {
        score: trainingBlocked.length ? 70 : 100,
        status: trainingBlocked.length ? "warn" : "pass",
        detail: trainingBlocked.length
          ? `You block ${trainingBlocked.length} training-data crawler${trainingBlocked.length === 1 ? "" : "s"} (${trainingBlocked.map((b) => b.token).join(", ")}). That's a business choice; it mainly affects what future AI models learn, not live search.`
          : "AI training crawlers are allowed. You can block them if you prefer — it's a business choice.",
        affected: [],
        facts: { trainingBlocked: trainingBlocked.length },
      }));
    }

    // llms.txt (emerging, unproven).
    const llmsFound = ctx.site ? ctx.site.llmsTxtFound : !ctx.findings.some((f) => f.code === "no_llms_txt");
    out.push(makeCheck(P, "geo.llms_txt", "llms.txt guide file (optional)", 0.5, {
      score: llmsFound ? 100 : 60,
      status: llmsFound ? "pass" : "warn",
      detail: llmsFound ? "You publish an /llms.txt file." : "No /llms.txt file. It's a new, optional convention with no proven effect yet.",
      facts: { found: llmsFound },
    }));

    // Quotable facts / statistics.
    if (v2Content.length === 0) {
      out.push(notMeasured(P, "geo.quotable_facts", "Specific facts and numbers", 2, v2.length ? "No content pages long enough to assess." : NEEDS_RESCAN));
    } else {
      const withStats = v2Content.filter((p) => (p.extracted!.statSentenceCount ?? 0) >= 2);
      const share = withStats.length / v2Content.length;
      const ex = withStats.flatMap((p) => p.extracted!.statExamples ?? [])[0];
      out.push(makeCheck(P, "geo.quotable_facts", "Specific facts and numbers", 2, {
        score: targetScore(share, 0.5),
        detail: `${withStats.length} of ${v2Content.length} content pages include at least two concrete facts or figures (numbers, prices, percentages) that AI tools can quote.`,
        affected: v2Content.filter((p) => !withStats.includes(p)).map(urlOf),
        evidence: ex ? `Example: "${ex.slice(0, 140)}"` : undefined,
        facts: { withStats: withStats.length, total: v2Content.length },
      }));
    }

    // Cited sources.
    if (v2Content.length === 0) {
      out.push(notMeasured(P, "geo.cited_sources", "Links to trusted sources", 1.5, v2.length ? "No content pages long enough to assess." : NEEDS_RESCAN));
    } else {
      const citing = v2Content.filter((p) => (p.extracted!.citationLinks?.length ?? 0) > 0);
      out.push(makeCheck(P, "geo.cited_sources", "Links to trusted sources", 1.5, {
        score: targetScore(citing.length / v2Content.length, 0.3),
        detail: `${citing.length} of ${v2Content.length} content pages link to an authoritative source (government, university, research, standards or major news).`,
        affected: v2Content.filter((p) => !citing.includes(p)).map(urlOf),
        facts: { citing: citing.length, total: v2Content.length },
      }));
    }

    // Freshness.
    if (v2Content.length === 0) {
      out.push(notMeasured(P, "geo.freshness", "Up-to-date, dated content", 2, v2.length ? "No content pages long enough to assess." : NEEDS_RESCAN));
    } else {
      const dated = v2Content.filter((p) => p.extracted!.dateModified || p.extracted!.datePublished);
      const recent = dated.filter((p) => {
        const d = Date.parse((p.extracted!.dateModified ?? p.extracted!.datePublished)!);
        return Number.isFinite(d) && ctx.now.getTime() - d <= FRESH_DAYS * DAY;
      });
      const datedShare = dated.length / v2Content.length;
      const recentShare = recent.length / v2Content.length;
      out.push(makeCheck(P, "geo.freshness", "Up-to-date, dated content", 2, {
        score: 100 * (0.5 * Math.min(1, datedShare / 0.6) + 0.5 * Math.min(1, recentShare / 0.4)),
        detail: `${dated.length} of ${v2Content.length} content pages show a published or updated date; ${recent.length} ${recent.length === 1 ? "was" : "were"} updated in the last 12 months.`,
        affected: v2Content.filter((p) => !recent.includes(p)).map(urlOf),
        facts: { dated: dated.length, recent: recent.length, total: v2Content.length },
      }));
    }

    // Author / expertise signals on articles.
    if (v2.length === 0) {
      out.push(notMeasured(P, "geo.author_signals", "Named authors and expertise", 1.5, NEEDS_RESCAN));
    } else {
      const articles = v2.filter(isArticlePage);
      if (articles.length === 0) {
        out.push(notMeasured(P, "geo.author_signals", "Named authors and expertise", 1.5, "No blog posts or articles were found in the pages we checked."));
      } else {
        const withAuthor = articles.filter((p) => p.extracted!.author || (p.extracted!.authorSignals?.length ?? 0) > 0);
        out.push(makeCheck(P, "geo.author_signals", "Named authors and expertise", 1.5, {
          score: targetScore(withAuthor.length / articles.length, 0.9),
          detail: `${withAuthor.length} of ${articles.length} articles name an author.`,
          affected: articles.filter((p) => !withAuthor.includes(p)).map(urlOf),
          facts: { withAuthor: withAuthor.length, total: articles.length },
        }));
      }
    }

    // Entity clarity: Organization schema with sameAs profiles.
    if (v2.length === 0) {
      out.push(notMeasured(P, "geo.entity_clarity", "AI can identify your business", 2, NEEDS_RESCAN));
    } else {
      const orgs = v2.map((p) => p.extracted!.organization).filter((o): o is NonNullable<typeof o> => !!o);
      const org = (home?.extracted?.organization ?? null) || orgs.sort((a, b) => b.sameAs.length - a.sameAs.length)[0] || null;
      const sameAs = org?.sameAs ?? [];
      const strong = sameAs.filter((u) => /wikipedia\.org|wikidata\.org|linkedin\.com|crunchbase\.com/i.test(u));
      const score = !org ? 10 : sameAs.length === 0 ? 35 : sameAs.length < 3 ? 65 : strong.length ? 100 : 85;
      out.push(makeCheck(P, "geo.entity_clarity", "AI can identify your business", 2, {
        score,
        detail: !org
          ? "No business identity markup (Organization schema) was found, so AI tools must guess who you are."
          : `Your business markup lists ${plural(sameAs.length, "official profile")} (sameAs)${strong.length ? `, including ${strong.length} from Wikipedia/Wikidata/LinkedIn/Crunchbase` : ""}.`,
        affected: [home ? urlOf(home) : homeUrl],
        facts: { hasOrg: !!org, sameAs: sameAs.length, strong: strong.length },
      }));
    }
  }

  // AI visibility (measured observations only).
  const ai = ctx.ai;
  if (!ai.measured || ai.simulated) {
    const why = ai.simulated ? "Only demo (simulated) AI answers exist — they are not used for scoring." : NOT_MEASURED_AI;
    out.push(notMeasured(P, "geo.ai_mention_rate", "Mentioned in AI answers", 3, why));
    out.push(notMeasured(P, "geo.ai_citation_rate", "Your site cited as a source", 2, why));
    out.push(notMeasured(P, "geo.competitor_share", "Share of voice vs competitors", 1.5, why));
  } else {
    const n = ai.sampleSize;
    const mr = ai.mentionRate ?? 0;
    const cr = ai.citationRate ?? 0;
    out.push(makeCheck(P, "geo.ai_mention_rate", "Mentioned in AI answers", 3, {
      score: targetScore(mr, 0.6),
      detail: `Your brand was mentioned in ${pct(mr)} of ${n} AI answers we collected (${ai.providers.join(", ")}).`,
      affectedCount: ai.promptsWhereMissing.length,
      facts: { mentionRate: mr, sample: n },
    }));
    out.push(makeCheck(P, "geo.ai_citation_rate", "Your site cited as a source", 2, {
      score: targetScore(cr, 0.4),
      detail: `Your website was linked as a source in ${pct(cr)} of ${n} AI answers.${ai.topCitedDomains.length ? ` Most-cited sites: ${ai.topCitedDomains.slice(0, 3).map((d) => d.domain).join(", ")}.` : ""}`,
      facts: { citationRate: cr, sample: n },
    }));
    const { brand, topCompetitor } = brandShareOf(ctx);
    if (!topCompetitor && brand === 0) {
      out.push(makeCheck(P, "geo.competitor_share", "Share of voice vs competitors", 1.5, {
        score: 50, status: "warn",
        detail: "Neither your brand nor tracked competitors were mentioned in the AI answers collected.",
        facts: { brandShare: 0 },
      }));
    } else {
      const score = !topCompetitor || brand >= topCompetitor.share ? 100 : (100 * brand) / topCompetitor.share;
      out.push(makeCheck(P, "geo.competitor_share", "Share of voice vs competitors", 1.5, {
        score,
        detail: topCompetitor
          ? `You hold ${pct(brand)} of brand mentions in AI answers; the leading competitor, ${topCompetitor.name}, holds ${pct(topCompetitor.share)}.`
          : `You hold ${pct(brand)} of brand mentions; no tracked competitors were mentioned.`,
        facts: { brandShare: brand, topCompetitor: topCompetitor?.name ?? null, topShare: topCompetitor?.share ?? null },
      }));
    }
  }
  return out;
}
