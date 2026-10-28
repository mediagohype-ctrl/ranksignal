// Strip anything internal from a SiteReport before it is shown on the public /r/[token] page.
// Removed: issue evidence snippets and action hooks, raw AI answer text (brand-knowledge summaries / inaccuracy
// quotes), crawl run ids. Kept: scores, pillars, plain-English issues + fixes, aggregate AI visibility numbers.
import type { SiteReport } from "@/lib/report/types";

export function toPublicReport(r: SiteReport): SiteReport {
  return {
    ...r,
    crawl: { ...r.crawl, crawlRunId: null },
    issues: r.issues.map((i) => ({
      id: i.id,
      pillar: i.pillar,
      title: i.title,
      whatsWrong: i.whatsWrong,
      whyItMatters: i.whyItMatters,
      howToFix: i.howToFix,
      impact: i.impact,
      effort: i.effort,
      affectedUrls: i.affectedUrls,
      affectedCount: i.affectedCount,
    })),
    aiVisibility: {
      ...r.aiVisibility,
      brandKnowledge: r.aiVisibility.brandKnowledge?.map((k) => ({
        provider: k.provider,
        knowsBrand: k.knowsBrand,
        summary: "",
        inaccuracies: [],
      })),
    },
  };
}
