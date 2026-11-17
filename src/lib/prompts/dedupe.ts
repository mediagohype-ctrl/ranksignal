// Near-duplicate customer questions (pure). "Best neck fan for outdoor use in Indian summer" and "Good neck fan for
// outdoor use in Indian heat" are the same question to an AI tool — asking both wastes an answer. Questions are
// reduced to their meaningful words (case, punctuation, filler words and simple synonyms removed) and compared by
// word overlap (Jaccard). 0.7 or more = the same question.

export const QUESTION_DUPLICATE_THRESHOLD = 0.7;

/** Filler and praise words that don't change what is being asked. */
const STOP = new Set([
  "a", "an", "the", "in", "on", "at", "for", "of", "to", "is", "are", "was", "be", "do", "does", "can", "could", "should", "would", "will",
  "i", "me", "my", "we", "you", "your", "it", "that", "this", "these", "those", "and", "or", "with", "from", "by", "as",
  "what", "which", "who", "where", "how", "when", "why", "there", "any", "some",
  "best", "top", "good", "great", "better", "nice", "right", "most", "really", "very",
  "recommend", "recommended", "suggest", "suggested", "find", "get", "use", "used", "using",
  "please", "tell", "give", "show", "need", "want", "looking", "look",
]);

/** Simple synonyms: every word in a group counts as the first one. */
const SYNONYM_GROUPS: string[][] = [
  ["summer", "heat", "hot", "summers"],
  ["india", "indian"],
  ["cheap", "affordable", "budget", "inexpensive", "lowcost"],
  ["price", "cost", "pricing", "rate", "charge", "fee"],
  ["buy", "purchase", "order", "shop"],
  ["company", "firm", "agency", "business", "provider"],
  ["choose", "pick", "select", "choosing", "picking", "selecting"],
  ["near", "nearby", "around", "local"],
  ["kid", "child", "children"],
  ["small", "little", "compact"],
  ["quick", "fast", "rapid"],
  ["online", "internet", "web"],
];
const SYNONYM = new Map<string, string>();
for (const g of SYNONYM_GROUPS) for (const w of g) SYNONYM.set(w, g[0]!);

const singular = (t: string) => (t.length > 3 && t.endsWith("ies") ? `${t.slice(0, -3)}y` : t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t);

/** The meaningful words of a question, normalised. */
export function questionTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)) {
    if (!raw || STOP.has(raw)) continue;
    const t = singular(raw);
    if (STOP.has(t)) continue;
    out.add(SYNONYM.get(t) ?? SYNONYM.get(raw) ?? t);
  }
  return out;
}

export function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return a.size === b.size ? 1 : 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function isNearDuplicate(a: string, b: string, threshold = QUESTION_DUPLICATE_THRESHOLD): boolean {
  return tokenOverlap(questionTokens(a), questionTokens(b)) >= threshold;
}

/**
 * Drops suggestions that are near-duplicates of a question the owner already has, or of an earlier suggestion.
 * Keeps the order; the first of each group of look-alikes wins.
 */
export function dedupeQuestions<T extends { text: string }>(items: T[], existing: string[] = [], threshold = QUESTION_DUPLICATE_THRESHOLD): T[] {
  const kept = existing.map(questionTokens).filter((t) => t.size > 0);
  const out: T[] = [];
  for (const item of items) {
    const tokens = questionTokens(item.text);
    if (tokens.size === 0) continue;
    if (kept.some((k) => tokenOverlap(k, tokens) >= threshold)) continue;
    kept.push(tokens);
    out.push(item);
  }
  return out;
}
