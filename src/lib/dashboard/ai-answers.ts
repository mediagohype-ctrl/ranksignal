// AI Answers tab (brief 5.6): turns one AI check's stored answers into the question list the owner sees.
// Pure (no I/O) so it is unit-tested and safe for server and client components.

export interface AnswerObservation {
  id: string;
  promptId: string;
  prompt: string;
  provider: string;
  platformLabel: string;
  brandMentioned: boolean;
  brandCited: boolean;
  brandRecommended: boolean;
  competitorMentions: Record<string, number>;
  rawResponse: string;
  citations: { url: string; domain: string; title?: string; ownedByCustomer: boolean }[];
  simulated: boolean;
}

export interface QuestionView {
  promptId: string;
  text: string;
  /** At least one AI tool named the business. */
  named: boolean;
  namedCount: number;
  answers: AnswerObservation[];
  /** Competitors / other brands named in answers that did NOT name the business, most-named first. */
  recommendedInstead: string[];
}

const BRAND_KEY = "__brand__";

/**
 * "Recommended instead: Upwork, Freelancer" — names that came up in the answers where the business wasn't named.
 * Ignores the business's own names (and the internal brand key), merges case-insensitively, sorts by how often
 * they were named, then by first appearance.
 */
export function recommendedInstead(
  answers: Pick<AnswerObservation, "brandMentioned" | "competitorMentions">[],
  ownNames: string[] = [],
  max = 3,
): string[] {
  const own = new Set([BRAND_KEY, ...ownNames].map((n) => n.trim().toLowerCase()));
  const tally = new Map<string, { name: string; count: number; order: number }>();
  let order = 0;
  for (const a of answers) {
    if (a.brandMentioned) continue;
    for (const [name, n] of Object.entries(a.competitorMentions ?? {})) {
      const key = name.trim().toLowerCase();
      if (!key || own.has(key) || !(typeof n === "number" && n > 0)) continue;
      const cur = tally.get(key);
      if (cur) cur.count += n;
      else tally.set(key, { name: name.trim(), count: n, order: order++ });
    }
  }
  return [...tally.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, max)
    .map((t) => t.name);
}

/** Groups answers by question, keeping the order questions were first asked. Real answers win over sample ones. */
export function groupByQuestion(observations: AnswerObservation[], ownNames: string[] = []): QuestionView[] {
  const real = observations.filter((o) => !o.simulated);
  const used = real.length ? real : observations;
  const byPrompt = new Map<string, AnswerObservation[]>();
  for (const o of used) {
    const list = byPrompt.get(o.promptId);
    if (list) list.push(o);
    else byPrompt.set(o.promptId, [o]);
  }
  return [...byPrompt.entries()].map(([promptId, answers]) => {
    const namedCount = answers.filter((a) => a.brandMentioned).length;
    return {
      promptId,
      text: answers[0].prompt,
      named: namedCount > 0,
      namedCount,
      answers,
      recommendedInstead: recommendedInstead(answers, ownNames),
    };
  });
}

/** "ChatGPT, Claude and Gemini" style list (de-duplicated, order kept). */
export function joinNames(names: string[]): string {
  const xs = [...new Set(names.filter(Boolean))];
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** Provider ids stored on VisibilityRun.providers (Json) → string[]. */
export function runProviders(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
}

export interface WrongFact {
  engine: string;
  statement: string;
}

/** Wrong things AI tools said about the business, from a run's metrics.brandKnowledge (sample runs ignored). */
export function wrongFacts(metrics: unknown, max = 10): WrongFact[] {
  const m = metrics && typeof metrics === "object" ? (metrics as { brandKnowledge?: unknown; simulated?: unknown }) : null;
  if (!m || m.simulated === true || !Array.isArray(m.brandKnowledge)) return [];
  const seen = new Set<string>();
  const out: WrongFact[] = [];
  for (const b of m.brandKnowledge) {
    if (!b || typeof b !== "object") continue;
    const engine = typeof (b as { provider?: unknown }).provider === "string" ? (b as { provider: string }).provider : "";
    if (/simulat/i.test(engine)) continue;
    const list = (b as { inaccuracies?: unknown }).inaccuracies;
    if (!Array.isArray(list)) continue;
    for (const s of list) {
      if (typeof s !== "string" || !s.trim()) continue;
      const key = s.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ engine, statement: s.trim().slice(0, 400) });
    }
  }
  return out.slice(0, max);
}

/** Title of the To-do task created by "Correct this" (fits the task title limit of 200). */
export function correctionTaskTitle(statement: string): string {
  const prefix = "Correct what AI says: ";
  const s = statement.trim().replace(/\s+/g, " ");
  const room = 200 - prefix.length;
  return prefix + (s.length > room ? `${s.slice(0, room - 1)}…` : s);
}

// ── One question in detail (AI Answers → question page) ──────────────────────────────────────────────────────

export interface RivalTally {
  name: string;
  /** How many AI tools named them for this question. */
  engines: number;
  /** Which AI tools (product names are applied by the caller). */
  providers: string[];
}

/** Everyone the AI tools named for this question instead of (or as well as) the business, most tools first. */
export function rivalsForQuestion(answers: Pick<AnswerObservation, "provider" | "platformLabel" | "competitorMentions">[], ownNames: string[] = []): RivalTally[] {
  const own = new Set([BRAND_KEY, ...ownNames].map((n) => n.trim().toLowerCase()));
  const tally = new Map<string, { name: string; providers: string[]; order: number }>();
  let order = 0;
  for (const a of answers) {
    const who = a.platformLabel || a.provider;
    for (const [name, n] of Object.entries(a.competitorMentions ?? {})) {
      const key = name.trim().toLowerCase();
      if (!key || own.has(key) || !(typeof n === "number" && n > 0)) continue;
      const cur = tally.get(key) ?? { name: name.trim(), providers: [], order: order++ };
      if (!cur.providers.includes(who)) cur.providers.push(who);
      tally.set(key, cur);
    }
  }
  return [...tally.values()]
    .sort((a, b) => b.providers.length - a.providers.length || a.order - b.order)
    .map((t) => ({ name: t.name, engines: t.providers.length, providers: t.providers }));
}

export interface SourceTally {
  domain: string;
  url: string;
  /** How many answers used this site as a source. */
  count: number;
  owned: boolean;
}

/** Websites the AI tools used as sources for this question (the places to be listed on), most used first. */
export function sourcesForQuestion(answers: Pick<AnswerObservation, "citations">[]): SourceTally[] {
  const tally = new Map<string, SourceTally & { order: number }>();
  let order = 0;
  for (const a of answers) {
    const seen = new Set<string>();
    for (const c of a.citations ?? []) {
      const domain = (c.domain || hostOfUrl(c.url)).replace(/^www\./, "").toLowerCase();
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);
      const cur = tally.get(domain);
      if (cur) cur.count++;
      else tally.set(domain, { domain, url: c.url, count: 1, owned: !!c.ownedByCustomer, order: order++ });
    }
  }
  return [...tally.values()].sort((a, b) => b.count - a.count || a.order - b.order).map((s) => ({ domain: s.domain, url: s.url, count: s.count, owned: s.owned }));
}

function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

const COMPARISON_RE = /\b(vs\.?|versus|alternatives?|compared?|better|which is)\b/i;

/**
 * Plain, specific steps to get named for one question: answer it on the website, get onto the sites AI reads,
 * and (for "X vs Y" / "alternatives" questions) publish a fair comparison. Uses this question's own data.
 */
export function stepsToGetNamed(o: {
  question: string;
  brand: string;
  named: boolean;
  rivals: RivalTally[];
  sources: SourceTally[];
}): { title: string; detail: string }[] {
  const steps: { title: string; detail: string }[] = [];
  const outside = o.sources.filter((s) => !s.owned).slice(0, 3).map((s) => s.domain);
  const top = o.rivals.slice(0, 2).map((r) => r.name);
  steps.push({
    title: "Answer this question on your website",
    detail: `Add a section (or a page) that answers "${o.question}" in the first two sentences, and says plainly that ${o.brand} does this — what you offer, for whom, where and the price range. AI tools quote pages that answer the question directly.`,
  });
  if (outside.length) {
    steps.push({
      title: `Get listed on ${joinNames(outside)}`,
      detail: `These are the websites the AI tools read for this question. Being listed or mentioned there is the fastest way to be named: create or update your profile, or ask to be added to their lists.`,
    });
  }
  if (COMPARISON_RE.test(o.question) && top.length) {
    steps.push({
      title: `Publish a fair comparison with ${joinNames(top)}`,
      detail: `People asking this are comparing options. A short, honest "${o.brand} vs ${top[0]}" page (a table of price, features and who each suits) gives AI tools a reason to include you.`,
    });
  }
  steps.push({
    title: "Collect reviews where AI tools look",
    detail: `Ask happy customers for a review on Google and on the sites above. AI tools favour businesses that others talk about${top.length ? ` — that's a big part of why ${joinNames(top)} get named` : ""}.`,
  });
  if (o.named) {
    steps.unshift({
      title: "Keep what's working",
      detail: "At least one AI tool already names you here. Keep the pages it links to up to date, and do the steps below to be named by the others too.",
    });
  }
  return steps;
}
