// Plain-English Markdown export of a SiteReport (downloadable).
import type { Pillar, SiteReport } from "@/lib/report/types";
import { productNames } from "@/lib/report/checks/geo";

const esc = (s: string) => s.replace(/([\\`*_[\]<>|])/g, "\\$1");
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`);
const statusIcon: Record<string, string> = { pass: "✅ Good", warn: "⚠️ Improve", fail: "❌ Fix", not_measured: "— Not checked yet" };
const IMPACT_LABEL: Record<string, string> = { high: "Urgent", medium: "Important", low: "Nice to have" };
const EFFORT_LABEL: Record<string, string> = { quick: "Quick fix", moderate: "Some work", involved: "Bigger project" };

export function reportToMarkdown(r: SiteReport): string {
  const L: string[] = [];
  const areaOf = (p: Pillar) => r.pillars.find((x) => x.pillar === p)?.label ?? p;
  const date = r.generatedAt.slice(0, 10);
  L.push(`# Website report for ${esc(r.brand)}`, "");
  L.push(`**Website:** ${r.websiteUrl}  `, `**Report date:** ${date}  `, `**Pages checked:** ${r.crawl.pagesCrawled}${r.crawl.finishedAt ? ` (website check finished ${r.crawl.finishedAt.slice(0, 10)})` : ""}`, "");
  L.push(`## Overall: ${r.overall.score === null ? "not scored yet" : `${r.overall.score}/100 (grade ${r.overall.grade})`}`, "", esc(r.overall.headline), "");
  L.push("## Summary", "", esc(r.executiveSummary), "");

  L.push("## Scores by area", "", "| Area | Score | Grade | In short |", "|---|---|---|---|");
  for (const p of r.pillars) L.push(`| ${p.label} | ${p.score ?? "—"} | ${p.grade ?? "—"} | ${esc(p.summary)} |`);
  L.push("", "_Google health = how easily Google can find and read your pages. Easy to quote = how easily Google and AI assistants can lift a short answer from your pages. Ready for AI = whether AI assistants like ChatGPT, Gemini and Perplexity can read your site and name or link to you. AI knows you = how clearly your business is described, and whether AI gets the facts right._", "");

  if (r.quickWins.length) {
    L.push("## Quick wins (start here)", "");
    for (const id of r.quickWins) {
      const i = r.issues.find((x) => x.id === id);
      if (i) L.push(`- **${esc(i.title)}**${i.affectedCount ? ` — ${i.affectedCount} affected` : ""}`);
    }
    L.push("");
  }

  if (r.strengths.length) {
    L.push("## What you're doing well", "", ...r.strengths.map((s) => `- ${esc(s)}`), "");
  }

  L.push("## What to fix", "");
  if (!r.issues.length) L.push(r.crawl.crawlRunId ? "No significant problems were found in the pages we checked." : "Check your website to see what to fix.", "");
  r.issues.forEach((i, idx) => {
    L.push(`### ${idx + 1}. ${esc(i.title)}`, "");
    L.push(`**Area:** ${areaOf(i.pillar)} · **Priority:** ${IMPACT_LABEL[i.impact] ?? i.impact} · **Effort:** ${EFFORT_LABEL[i.effort] ?? i.effort} · **Affected:** ${i.affectedCount}`, "");
    L.push(`**What's wrong:** ${esc(i.whatsWrong)}`, "", `**Why it matters:** ${esc(i.whyItMatters)}`, "", "**How to fix it:**", "");
    i.howToFix.forEach((s, n) => L.push(`${n + 1}. ${esc(s)}`));
    if (i.evidence) L.push("", `_What we saw: ${esc(i.evidence)}_`);
    if (i.affectedUrls.length) {
      L.push("", "<details><summary>Affected pages</summary>", "");
      for (const u of i.affectedUrls) L.push(`- ${u}`);
      if (i.affectedCount > i.affectedUrls.length) L.push(`- …and ${i.affectedCount - i.affectedUrls.length} more`);
      L.push("", "</details>");
    }
    L.push("");
  });

  const ai = r.aiVisibility;
  L.push("## AI mentions", "");
  if (!ai.measured) L.push("Not checked yet. Run an AI check to see how often AI assistants name and recommend you.", "");
  else {
    if (ai.simulated) L.push("> ⚠️ These figures come from **made-up demo answers**, not real AI assistants. They don't count toward your scores.", "");
    L.push(`Based on ${ai.sampleSize} AI answers from ${productNames(ai.providers) || "AI assistants"}${ai.measuredAt ? ` (checked ${ai.measuredAt.slice(0, 10)})` : ""}:`, "");
    L.push(`- Named in ${pct(ai.mentionRate)} of answers`, `- Linked to your site in ${pct(ai.citationRate)} of answers`, `- Recommended in ${pct(ai.recommendationRate)} of answers`);
    if (ai.topCompetitors.length) L.push(`- Competitors named most: ${ai.topCompetitors.map((c) => `${esc(c.name)} (${pct(c.share)})`).join(", ")}`);
    if (ai.topCitedDomains.length) L.push(`- Websites AI links to most: ${ai.topCitedDomains.slice(0, 5).map((d) => `${d.domain}${d.owned ? " (yours)" : ""} ×${d.count}`).join(", ")}`);
    L.push("");
    if (ai.promptsWhereMissing.length) {
      L.push("**Customer questions where you weren't named:**", "");
      for (const p of ai.promptsWhereMissing) L.push(`- “${esc(p.prompt)}”${p.competitorsMentioned.length ? ` — named instead: ${p.competitorsMentioned.map(esc).join(", ")}` : ""}`);
      L.push("");
    }
  }
  if (ai.brandKnowledge?.length) {
    L.push("**What AI assistants know about you:**", "");
    for (const b of ai.brandKnowledge) {
      L.push(`- ${esc(productNames([b.provider]))}: ${b.knowsBrand ? "knows your business" : "doesn't know your business"}${b.summary ? ` — “${esc(b.summary.slice(0, 300))}”` : ""}`);
      for (const x of b.inaccuracies) L.push(`  - Wrong: ${esc(x)}`);
    }
    L.push("");
  }

  L.push("## Everything we checked", "");
  for (const p of r.pillars) {
    if (!p.checks.length) continue;
    L.push(`### ${p.label}`, "", "| Check | Result | Score | Detail |", "|---|---|---|---|");
    for (const c of p.checks) L.push(`| ${esc(c.label)} | ${statusIcon[c.status]} | ${c.status === "not_measured" ? "—" : c.score} | ${esc(c.detail)} |`);
    L.push("");
  }

  L.push("## About this report", "", ...r.limitations.map((l) => `- ${esc(l)}`), "", `_Scoring method ${r.methodologyVersion}. Scores describe what we saw; they are not a promise of Google rankings or AI mentions._`, "");
  return L.join("\n");
}
