// Plain-English Markdown export of a SiteReport (downloadable).
import type { SiteReport } from "@/lib/report/types";

const esc = (s: string) => s.replace(/([\\`*_[\]<>|])/g, "\\$1");
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`);
const statusIcon: Record<string, string> = { pass: "✅ Pass", warn: "⚠️ Improve", fail: "❌ Fix", not_measured: "— Not measured" };

export function reportToMarkdown(r: SiteReport): string {
  const L: string[] = [];
  const date = r.generatedAt.slice(0, 10);
  L.push(`# Website report for ${esc(r.brand)}`, "");
  L.push(`**Website:** ${r.websiteUrl}  `, `**Report date:** ${date}  `, `**Pages checked:** ${r.crawl.pagesCrawled}${r.crawl.finishedAt ? ` (scan finished ${r.crawl.finishedAt.slice(0, 10)})` : ""}`, "");
  L.push(`## Overall: ${r.overall.score === null ? "not scored yet" : `${r.overall.score}/100 (grade ${r.overall.grade})`}`, "", esc(r.overall.headline), "");
  L.push("## Summary", "", esc(r.executiveSummary), "");

  L.push("## Scores by area", "", "| Area | Score | Grade | In short |", "|---|---|---|---|");
  for (const p of r.pillars) L.push(`| ${p.label} | ${p.score ?? "—"} | ${p.grade ?? "—"} | ${esc(p.summary)} |`);
  L.push("", "_SEO = being found in Google. AEO = being picked as the answer in featured snippets and AI overviews. GEO = being mentioned and cited by AI assistants like ChatGPT, Gemini and Perplexity. Brand = how clearly and consistently your business presents itself._", "");

  if (r.quickWins.length) {
    L.push("## Quick wins (start here)", "");
    for (const id of r.quickWins) {
      const i = r.issues.find((x) => x.id === id);
      if (i) L.push(`- **${esc(i.title)}** — ${i.affectedCount} affected`);
    }
    L.push("");
  }

  if (r.strengths.length) {
    L.push("## What you're doing well", "", ...r.strengths.map((s) => `- ${esc(s)}`), "");
  }

  L.push("## What to fix", "");
  if (!r.issues.length) L.push(r.crawl.crawlRunId ? "No significant problems were found in the pages we checked." : "Run a scan to see what to fix.", "");
  r.issues.forEach((i, idx) => {
    L.push(`### ${idx + 1}. ${esc(i.title)}`, "");
    L.push(`**Area:** ${i.pillar.toUpperCase()} · **Impact:** ${i.impact} · **Effort:** ${i.effort} · **Affected:** ${i.affectedCount}`, "");
    L.push(`**What's wrong:** ${esc(i.whatsWrong)}`, "", `**Why it matters:** ${esc(i.whyItMatters)}`, "", "**How to fix it:**", "");
    i.howToFix.forEach((s, n) => L.push(`${n + 1}. ${esc(s)}`));
    if (i.evidence) L.push("", `_Evidence: ${esc(i.evidence)}_`);
    if (i.affectedUrls.length) {
      L.push("", "<details><summary>Affected pages</summary>", "");
      for (const u of i.affectedUrls) L.push(`- ${u}`);
      if (i.affectedCount > i.affectedUrls.length) L.push(`- …and ${i.affectedCount - i.affectedUrls.length} more`);
      L.push("", "</details>");
    }
    L.push("");
  });

  const ai = r.aiVisibility;
  L.push("## AI visibility", "");
  if (!ai.measured) L.push("Not measured yet. Run an AI visibility check to see how often AI assistants mention and recommend you.", "");
  else {
    if (ai.simulated) L.push("> ⚠️ These figures come from **simulated demo answers**, not real AI tools. They are not used in your scores.", "");
    L.push(`Based on ${ai.sampleSize} AI answers from ${ai.providers.join(", ") || "AI providers"}${ai.measuredAt ? ` (measured ${ai.measuredAt.slice(0, 10)})` : ""}:`, "");
    L.push(`- Mentioned: ${pct(ai.mentionRate)} of answers`, `- Your site cited as a source: ${pct(ai.citationRate)}`, `- Recommended: ${pct(ai.recommendationRate)}`);
    if (ai.topCompetitors.length) L.push(`- Competitors mentioned most: ${ai.topCompetitors.map((c) => `${esc(c.name)} (${pct(c.share)})`).join(", ")}`);
    if (ai.topCitedDomains.length) L.push(`- Sites AI cites most: ${ai.topCitedDomains.slice(0, 5).map((d) => `${d.domain}${d.owned ? " (yours)" : ""} ×${d.count}`).join(", ")}`);
    L.push("");
    if (ai.promptsWhereMissing.length) {
      L.push("**Questions where you weren't mentioned:**", "");
      for (const p of ai.promptsWhereMissing) L.push(`- “${esc(p.prompt)}”${p.competitorsMentioned.length ? ` — mentioned instead: ${p.competitorsMentioned.map(esc).join(", ")}` : ""}`);
      L.push("");
    }
  }
  if (ai.brandKnowledge?.length) {
    L.push("**What AI tools know about you:**", "");
    for (const b of ai.brandKnowledge) {
      L.push(`- ${esc(b.provider)}: ${b.knowsBrand ? "recognises your brand" : "doesn't recognise your brand"}${b.summary ? ` — “${esc(b.summary.slice(0, 300))}”` : ""}`);
      for (const x of b.inaccuracies) L.push(`  - Inaccurate: ${esc(x)}`);
    }
    L.push("");
  }

  L.push("## All checks", "");
  for (const p of r.pillars) {
    if (!p.checks.length) continue;
    L.push(`### ${p.label}`, "", "| Check | Result | Score | Detail |", "|---|---|---|---|");
    for (const c of p.checks) L.push(`| ${esc(c.label)} | ${statusIcon[c.status]} | ${c.status === "not_measured" ? "—" : c.score} | ${esc(c.detail)} |`);
    L.push("");
  }

  L.push("## About this report", "", ...r.limitations.map((l) => `- ${esc(l)}`), "", `_Methodology ${r.methodologyVersion}. Scores describe what we observed; they are not a promise of rankings or AI mentions._`, "");
  return L.join("\n");
}
