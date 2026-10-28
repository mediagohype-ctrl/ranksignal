// Executive summary: a deterministic template, optionally rewritten by the LLM from computed facts only.
import { z } from "zod";
import type { SiteReport } from "@/lib/report/types";
import { generateStructured, isLlmConfigured } from "@/lib/providers/llm";

const pctOf = (n: number | null) => `${Math.round((n ?? 0) * 100)}%`;
/** Wording we never allow in owner-facing copy (no promised outcomes). */
export const FORBIDDEN_CLAIMS = /\b(guarantee[sd]?|guaranteeing|promise[sd]?|will rank|rank #?1|number one|top spot|100% (?:sure|certain))\b/i;

export function templateSummary(r: SiteReport): string {
  if (!r.crawl.crawlRunId) {
    return `We haven't scanned ${r.websiteUrl} yet. Start a scan and we'll check how well search engines, answer engines and AI assistants can find, understand and recommend ${r.brand}. The report will explain each problem in plain language with step-by-step fixes.`;
  }
  const s: string[] = [];
  const scored = r.pillars.filter((p) => p.score !== null);
  if (r.overall.score === null) {
    s.push(`We scanned ${r.crawl.pagesCrawled} pages of ${r.websiteUrl} but couldn't read enough of them to score the site.`);
  } else {
    s.push(`We checked ${r.crawl.pagesCrawled} pages of ${r.websiteUrl}, and the site scores ${r.overall.score}/100 overall (grade ${r.overall.grade}).`);
    if (scored.length > 1) {
      const best = [...scored].sort((a, b) => b.score! - a.score!)[0];
      const worst = [...scored].sort((a, b) => a.score! - b.score!)[0];
      s.push(`Your strongest area is ${best.label} (${best.score}/100) and the weakest is ${worst.label} (${worst.score}/100).`);
    }
  }
  const high = r.issues.filter((i) => i.impact === "high");
  if (r.issues.length) {
    s.push(`We found ${r.issues.length} things to improve${high.length ? `, ${high.length} of them important` : ""}; the first to tackle is “${r.issues[0].title.replace(/\.$/, "")}”.`);
  }
  if (r.quickWins.length) s.push(`${r.quickWins.length} of these are quick fixes you can do in under an hour each.`);
  const ai = r.aiVisibility;
  if (ai.measured && !ai.simulated) {
    s.push(`In ${ai.sampleSize} AI answers we sampled, ${r.brand} was mentioned ${pctOf(ai.mentionRate)} of the time and your site was cited ${pctOf(ai.citationRate)} of the time.`);
  } else {
    s.push(`AI visibility hasn't been measured with real AI answers yet — run an AI visibility check to see how often assistants mention ${r.brand}.`);
  }
  return s.slice(0, 5).join(" ");
}

const summarySchema = z.object({ summary: z.string().min(40).max(1500) });

/** LLM-written summary from computed facts only. Returns null when unconfigured, failed or off-policy. */
export async function llmSummary(r: SiteReport): Promise<{ text: string; costMicros: number } | null> {
  if (!isLlmConfigured() || !r.crawl.crawlRunId) return null;
  const facts = {
    brand: r.brand,
    website: r.websiteUrl,
    pagesChecked: r.crawl.pagesCrawled,
    overall: r.overall,
    pillars: r.pillars.map((p) => ({ area: p.label, score: p.score, grade: p.grade })),
    topIssues: r.issues.slice(0, 5).map((i) => ({ title: i.title, impact: i.impact, effort: i.effort, pagesAffected: i.affectedCount })),
    quickWinCount: r.quickWins.length,
    strengths: r.strengths.slice(0, 3),
    aiVisibility: r.aiVisibility.measured && !r.aiVisibility.simulated
      ? { answersSampled: r.aiVisibility.sampleSize, mentionRate: r.aiVisibility.mentionRate, citationRate: r.aiVisibility.citationRate, topCompetitors: r.aiVisibility.topCompetitors.slice(0, 3) }
      : "not measured",
  };
  try {
    const res = await generateStructured({
      schema: summarySchema,
      system:
        "You write the executive summary of a website report for a non-technical small-business owner. " +
        "Write 3 to 5 short, plain sentences using ONLY the facts provided — do not add numbers or claims. " +
        "Explain any technical term in a few words. Mention the overall score, the biggest problem and one encouraging point. " +
        "Never promise or guarantee rankings, traffic, AI mentions or any outcome. Return JSON {\"summary\": string}.",
      user: JSON.stringify(facts),
      maxTokens: 500,
    });
    const text = res?.data.summary.trim();
    if (!text || FORBIDDEN_CLAIMS.test(text)) return null;
    return { text, costMicros: res!.costMicros };
  } catch {
    return null;
  }
}
