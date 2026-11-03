// Executive summary: a deterministic template, optionally rewritten by the LLM from computed facts only.
import { z } from "zod";
import type { SiteReport } from "@/lib/report/types";
import { plural } from "@/lib/report/inputs";
import { generateStructured, isLlmConfigured } from "@/lib/providers/llm";

const pctOf = (n: number | null) => `${Math.round((n ?? 0) * 100)}%`;
/** Wording we never allow in owner-facing copy (no promised outcomes). */
export const FORBIDDEN_CLAIMS = /\b(guarantee[sd]?|guaranteeing|promise[sd]?|will rank|rank #?1|number one|top spot|100% (?:sure|certain))\b/i;

export function templateSummary(r: SiteReport): string {
  if (!r.crawl.crawlRunId) {
    return `We haven't checked ${r.websiteUrl} yet. Check your website and we'll see how well Google and AI assistants like ChatGPT can find, understand and recommend ${r.brand}. The report explains each problem in plain words, with step-by-step fixes.`;
  }
  const s: string[] = [];
  const scored = r.pillars.filter((p) => p.score !== null);
  if (r.overall.score === null) {
    s.push(`We checked ${plural(r.crawl.pagesCrawled, "page")} of ${r.websiteUrl} but couldn't read enough of them to score the site.`);
  } else {
    s.push(`We checked ${plural(r.crawl.pagesCrawled, "page")} of ${r.websiteUrl}, and the site scores ${r.overall.score} out of 100 overall.`);
    if (scored.length > 1) {
      const best = [...scored].sort((a, b) => b.score! - a.score!)[0];
      const worst = [...scored].sort((a, b) => a.score! - b.score!)[0];
      s.push(`Your strongest area is ${best.label} (${best.score} out of 100) and the weakest is ${worst.label} (${worst.score} out of 100).`);
    }
  }
  const high = r.issues.filter((i) => i.impact === "high");
  if (r.issues.length) {
    s.push(`We found ${plural(r.issues.length, "thing")} to improve${high.length ? `, ${high.length} of them urgent` : ""}; start with “${r.issues[0].title.replace(/\.$/, "")}”.`);
  }
  if (r.quickWins.length) s.push(r.quickWins.length === 1 ? "One of these is a quick fix you can do in under an hour." : `${r.quickWins.length} of these are quick fixes you can do in under an hour each.`);
  const ai = r.aiVisibility;
  if (ai.measured && !ai.simulated) {
    s.push(`In ${ai.sampleSize} AI answers we collected, ${r.brand} was named ${pctOf(ai.mentionRate)} of the time and your site was linked ${pctOf(ai.citationRate)} of the time.`);
  } else {
    s.push(`We haven't asked real AI assistants about you yet — run an AI check to see how often they name ${r.brand}.`);
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
