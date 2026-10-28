// Deterministic, rule-based recommendation builder (blueprint §2.2 step 6). Pure: no I/O.
// Every recommendation cites its evidence. Text drafted here is a starting point for human review;
// page text is untrusted data and is only quoted/truncated, never interpreted as instructions.
import type { ActionTarget, ProposedChange, RiskClass, VisibilityMetrics } from "@/lib/types";

export type Effort = "low" | "medium" | "high";

export interface RecDraft {
  type: string;
  target: ActionTarget;
  rationale: string;
  evidenceRefs: Record<string, unknown>[];
  impact: number; // 1–5
  effort: Effort;
  confidence: number; // 0–1
  expectedImpact: string;
  proposedChange: ProposedChange | null;
  /** If set, an LLM may refine `proposedChange.after` from approved facts + this page evidence. */
  llmDraft?: { kind: "meta_description" | "brief"; page?: PageEvidence; prompt?: string };
}

export interface PageEvidence {
  url: string;
  title: string | null;
  description: string | null;
  h1: string[];
  textSample: string;
}

export interface FindingEvidence {
  id: string;
  code: string;
  severity: string;
  category: string;
  message: string;
  pageUrl: string | null;
  evidence: Record<string, unknown>;
  page?: PageEvidence | null;
}

export interface PromptEvidence {
  id: string;
  text: string;
  intent: string;
  priority: number;
  observations: {
    brandMentioned: boolean;
    brandCited: boolean;
    competitorMentions: Record<string, number>;
    citations: { domain: string }[];
  }[];
}

export interface RecInput {
  brand: string;
  findings: FindingEvidence[];
  visibility?: { runId: string; metrics: VisibilityMetrics | null; prompts: PromptEvidence[] } | null;
}

const EFFORT_WEIGHT: Record<Effort, number> = { low: 1, medium: 2, high: 3 };
const RISK_PENALTY: Record<RiskClass, number> = { A: 1, B: 0.95, C: 0.8, D: 0.5 };

/** priorityScore = impact × confidence / effort × risk penalty, scaled to 0–100. */
export function scorePriority(impact: number, confidence: number, effort: Effort, riskClass: RiskClass) {
  const raw = (impact / 5) * Math.max(0, Math.min(1, confidence)) / EFFORT_WEIGHT[effort] * RISK_PENALTY[riskClass];
  const score = Math.round(raw * 1000) / 10;
  const priority = score >= 60 ? "critical" : score >= 35 ? "high" : score >= 15 ? "medium" : "low";
  return { score, priority };
}

export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:–-]+$/, "") + "…";
}

function firstSentence(text: string): string {
  const m = text.replace(/\s+/g, " ").trim().match(/^(.{30,200}?[.!?])(\s|$)/);
  return m ? m[1] : text.slice(0, 160);
}

export function draftMetaDescription(page: PageEvidence | null | undefined, brand: string): string {
  const subject = page?.h1?.[0] || page?.title || brand;
  const lead = page?.textSample ? firstSentence(page.textSample) : "";
  const base = lead && !lead.toLowerCase().startsWith(subject.toLowerCase()) ? `${subject}: ${lead}` : lead || `${subject} from ${brand}.`;
  return clip(base, 155);
}

function briefText(o: { kind: "content" | "comparison"; prompt: PromptEvidence; brand: string; competitors: string[]; citedDomains: string[] }) {
  const lines = [
    `# ${o.kind === "comparison" ? "Comparison page brief" : "Content brief"}: "${o.prompt.text}"`,
    `Intent: ${o.prompt.intent}`,
    o.competitors.length ? `Competitors appearing in AI answers for this prompt: ${o.competitors.join(", ")}` : "",
    o.citedDomains.length ? `Sources AI answers currently cite: ${o.citedDomains.slice(0, 8).join(", ")}` : "",
    "## Goal",
    `Publish a page that answers this question directly and accurately so ${o.brand} is a credible, citable source.`,
    "## Suggested outline",
    "1. A direct 2–3 sentence answer to the question at the top.",
    o.kind === "comparison"
      ? `2. A fair comparison table (${[o.brand, ...o.competitors.slice(0, 3)].join(" vs ")}) using verifiable, dated facts.`
      : "2. Key facts, specifications or steps, each verifiable.",
    "3. FAQs drawn from real customer questions.",
    "4. Clear authorship, last-updated date and links to primary sources.",
    "## Guardrails",
    "- Use only approved business facts; mark anything unverified for review.",
    "- No guaranteed ranking, medical, legal or financial claims.",
    "- Outcomes are measured after publishing; inclusion in AI answers is not guaranteed.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function buildRecommendations(input: RecInput): RecDraft[] {
  const out: RecDraft[] = [];
  const ref = (f: FindingEvidence) => ({ kind: "finding", id: f.id, code: f.code });

  for (const f of input.findings) {
    const url = f.pageUrl ?? (typeof f.evidence.url === "string" ? f.evidence.url : undefined);
    const target: ActionTarget = { resourceType: "page", url };
    switch (f.code) {
      case "missing_meta_description":
      case "meta_description_too_long": {
        if (!url) break;
        const before = f.page?.description ?? (typeof f.evidence.description === "string" ? f.evidence.description : null);
        const after = f.code === "meta_description_too_long" && before ? clip(before, 155) : draftMetaDescription(f.page, input.brand);
        out.push({
          type: "update_meta_description", target, rationale: f.message, evidenceRefs: [ref(f)],
          impact: 3, effort: "low", confidence: 0.7,
          expectedImpact: "Clearer search/AI snippet for this page. Measured after re-crawl; not a ranking guarantee.",
          proposedChange: { field: "meta_description", before, after },
          llmDraft: { kind: "meta_description", page: f.page ?? undefined },
        });
        break;
      }
      case "missing_title":
      case "title_too_long": {
        if (!url) break;
        const before = f.page?.title ?? (typeof f.evidence.title === "string" ? f.evidence.title : null);
        let after: string | null = null;
        if (f.code === "missing_title") {
          const h = f.page?.h1?.[0];
          after = h ? clip(`${h} | ${input.brand}`, 60) : null;
        } else if (before) {
          const seg = before.split(/\s[|–—-]\s/)[0];
          after = seg.length >= 15 && seg.length < before.length ? clip(seg, 60) : clip(before, 60);
        }
        if (!after) break;
        out.push({
          type: "update_title", target, rationale: f.message, evidenceRefs: [ref(f)],
          impact: f.code === "missing_title" ? 4 : 2, effort: "low", confidence: 0.6,
          expectedImpact: "More descriptive page title. Measured after re-crawl.",
          proposedChange: { field: "title", before, after },
        });
        break;
      }
      case "question_page_without_faq_schema": {
        if (!url) break;
        const qs = Array.isArray(f.evidence.questionHeadings) ? (f.evidence.questionHeadings as string[]).slice(0, 5) : [];
        const jsonLd = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: qs.map((q) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: "[REPLACE with the approved answer shown on the page]" } })),
        };
        out.push({
          type: "add_faq_schema", target,
          rationale: `${f.message} Answers must match the visible page text before approval.`,
          evidenceRefs: [ref(f)], impact: 2, effort: "medium", confidence: 0.5,
          expectedImpact: "Machine-readable Q&A for this page. Does not guarantee rich results or AI inclusion.",
          proposedChange: { field: "schema", before: null, after: JSON.stringify(jsonLd, null, 2) },
        });
        break;
      }
      case "ai_crawler_access": {
        const blocked = Array.isArray(f.evidence.blocked) ? (f.evidence.blocked as string[]) : [];
        out.push({
          type: "robots_review", target: { resourceType: "site", url },
          rationale: f.message, evidenceRefs: [ref(f)], impact: f.severity === "medium" ? 4 : 1, effort: "low", confidence: 0.8,
          expectedImpact: "A deliberate, documented robots.txt policy for AI crawlers.",
          proposedChange: { field: "robots", before: null, after: `Review robots.txt rules for: ${blocked.join(", ")}. Decide per crawler (AI search vs training) and update manually.` },
        });
        break;
      }
      default:
        if (f.severity === "critical" || f.severity === "high") {
          out.push({
            type: "internal_task", target: { resourceType: "page", url },
            rationale: f.message, evidenceRefs: [ref(f)], impact: f.severity === "critical" ? 5 : 4, effort: "medium", confidence: 0.8,
            expectedImpact: "Resolves a technical issue found in the audit.",
            proposedChange: { field: "task", before: null, after: `Fix: ${f.message}${url ? `\nPage: ${url}` : ""}` },
          });
        }
    }
  }

  // ---- Visibility-driven briefs ----
  const v = input.visibility;
  if (v && v.prompts.length) {
    const sim = v.metrics?.simulated ? " (based on SIMULATED visibility data — demo only)" : "";
    const confBase = v.metrics?.simulated ? 0.3 : 0.6;
    const citationRate = v.metrics?.citationRate ?? 0;
    const competitorsOf = (p: PromptEvidence) => {
      const counts: Record<string, number> = {};
      for (const o of p.observations) for (const [n, c] of Object.entries(o.competitorMentions)) if (c > 0) counts[n] = (counts[n] ?? 0) + 1;
      return counts;
    };
    const domainsOf = (p: PromptEvidence) => [...new Set(p.observations.flatMap((o) => o.citations.map((c) => c.domain)))];

    if (citationRate < 0.2) {
      const uncited = v.prompts
        .filter((p) => p.observations.length && p.observations.every((o) => !o.brandCited))
        .sort((a, b) => a.priority - b.priority || Object.keys(competitorsOf(b)).length - Object.keys(competitorsOf(a)).length)
        .slice(0, 3);
      for (const p of uncited) {
        const comps = Object.keys(competitorsOf(p));
        out.push({
          type: "content_brief", target: { resourceType: "prompt", resourceId: p.id },
          rationale: `Your site was not cited in any of ${p.observations.length} sampled answers for "${p.text}" (overall citation rate ${(citationRate * 100).toFixed(0)}%)${sim}.`,
          evidenceRefs: [{ kind: "visibility_run", id: v.runId }, { kind: "prompt", id: p.id }],
          impact: 4, effort: "high", confidence: confBase,
          expectedImpact: "A citable source page for this question. Changes in citation rate are measured, not guaranteed.",
          proposedChange: { field: "brief", before: null, after: briefText({ kind: "content", prompt: p, brand: input.brand, competitors: comps, citedDomains: domainsOf(p) }) },
          llmDraft: { kind: "brief", prompt: p.text },
        });
      }
    }

    const dominated = v.prompts
      .map((p) => {
        const counts = competitorsOf(p);
        const n = p.observations.length || 1;
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        const brandRate = p.observations.filter((o) => o.brandMentioned).length / n;
        return { p, top, share: top ? top[1] / n : 0, brandRate };
      })
      .filter((x) => x.top && x.share >= 0.5 && x.brandRate < 0.25)
      .sort((a, b) => b.share - a.share)
      .slice(0, 3);
    for (const d of dominated) {
      out.push({
        type: "comparison_page_brief", target: { resourceType: "prompt", resourceId: d.p.id },
        rationale: `${d.top![0]} appears in ${(d.share * 100).toFixed(0)}% of sampled answers for "${d.p.text}" while your brand appears in ${(d.brandRate * 100).toFixed(0)}%${sim}.`,
        evidenceRefs: [{ kind: "visibility_run", id: v.runId }, { kind: "prompt", id: d.p.id }],
        impact: 3, effort: "high", confidence: confBase,
        expectedImpact: "A fair, factual comparison resource. Measured on the next visibility run.",
        proposedChange: { field: "brief", before: null, after: briefText({ kind: "comparison", prompt: d.p, brand: input.brand, competitors: Object.keys(competitorsOf(d.p)), citedDomains: domainsOf(d.p) }) },
        llmDraft: { kind: "brief", prompt: d.p.text },
      });
    }
  }
  return out;
}

/** Stable dedupe key for "same type + same target". */
export function dedupeKey(type: string, target: ActionTarget | null | undefined) {
  const t = target?.resourceId ?? (target?.url ?? "").replace(/\/+$/, "").toLowerCase();
  return `${type}::${target?.resourceType ?? ""}::${t}`;
}
