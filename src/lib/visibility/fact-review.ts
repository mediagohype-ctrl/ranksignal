// "Check these facts" (AI answers page): things AI tools say about the business that the owner should look at.
// We never call a statement "wrong" on our own — we only know it is NOT CONFIRMED (the owner hasn't told us) or
// that it does not match the business details the owner gave. The owner decides: "✓ Correct" (remembered, never
// asked again, and given to later brand checks) or "✗ Wrong" (goes on the To-do list to get corrected).
// Statements about complaints, scams, lawsuits… are shown apart, as reputation risks. Pure and client-safe.

export type FactStatus = "not_confirmed" | "conflict";

export interface FactToCheck {
  /** Provider id of the AI tool that said it ("" when unknown). */
  engine: string;
  statement: string;
  /** not_confirmed = we can't tell; conflict = it doesn't match the business details the owner gave us. */
  status: FactStatus;
  /** Mentions complaints, payment disputes, scams, fraud, lawsuits… */
  risk: boolean;
}

export interface RejectedFact {
  statement: string;
  /** What is right, in the owner's words (optional). */
  correction?: string;
  /** The To-do task created to get it corrected. */
  taskId?: string;
}

export interface FactReviews {
  /** Statements the owner marked "✓ Correct". */
  confirmed: string[];
  /** Statements the owner marked "✗ Wrong". */
  rejected: RejectedFact[];
}

/** Keys on Project.settings (JSON). */
export const CONFIRMED_FACTS_KEY = "confirmedFacts";
export const REJECTED_FACTS_KEY = "rejectedFacts";
export const MAX_REVIEWED_FACTS = 100;
const MAX_STATEMENT = 400;

const clean = (s: unknown, max = MAX_STATEMENT): string => (typeof s === "string" ? s.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** Reads the owner's fact decisions from Project.settings (defensive: anything malformed is dropped). */
export function readFactReviews(settings: unknown): FactReviews {
  const o = settings && typeof settings === "object" && !Array.isArray(settings) ? (settings as Record<string, unknown>) : {};
  const confirmed = (Array.isArray(o[CONFIRMED_FACTS_KEY]) ? (o[CONFIRMED_FACTS_KEY] as unknown[]) : []).map((x) => clean(x)).filter(Boolean);
  const rejected: RejectedFact[] = [];
  for (const r of Array.isArray(o[REJECTED_FACTS_KEY]) ? (o[REJECTED_FACTS_KEY] as unknown[]) : []) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const statement = clean(row.statement);
    if (!statement) continue;
    const correction = clean(row.correction, 300);
    const taskId = clean(row.taskId, 64);
    rejected.push({ statement, ...(correction ? { correction } : {}), ...(taskId ? { taskId } : {}) });
  }
  return { confirmed: confirmed.slice(-MAX_REVIEWED_FACTS), rejected: rejected.slice(-MAX_REVIEWED_FACTS) };
}

const STOP = new Set(
  "a an the is are was were be been it its this that of in on at to for by with and or as from has have had their they he she his her our your you we".split(" "),
);
const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));

/** Same statement, allowing for small wording changes between two AI checks ("Founded by X" / "X founded it"). */
export function sameFact(a: string, b: string): boolean {
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  if (wa.size === 0 || wb.size === 0) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  if (shared === wa.size && shared === wb.size) return true;
  // Short statements must match exactly: one different word ("Pune" / "Mumbai") changes the fact.
  if (Math.min(wa.size, wb.size) < 4) return false;
  return shared / (wa.size + wb.size - shared) >= 0.75;
}

/** Record "✓ Correct": remember the statement (and forget an earlier "✗ Wrong" for it). */
export function withConfirmedFact(r: FactReviews, statement: string): FactReviews {
  const s = clean(statement);
  if (!s) return r;
  return {
    confirmed: [...r.confirmed.filter((c) => !sameFact(c, s)), s].slice(-MAX_REVIEWED_FACTS),
    rejected: r.rejected.filter((x) => !sameFact(x.statement, s)),
  };
}

/** Record "✗ Wrong" (with what is right, and the To-do task that was created). */
export function withRejectedFact(r: FactReviews, fact: RejectedFact): FactReviews {
  const statement = clean(fact.statement);
  if (!statement) return r;
  const correction = clean(fact.correction, 300);
  const row: RejectedFact = { statement, ...(correction ? { correction } : {}), ...(fact.taskId ? { taskId: fact.taskId } : {}) };
  return {
    confirmed: r.confirmed.filter((c) => !sameFact(c, statement)),
    rejected: [...r.rejected.filter((x) => !sameFact(x.statement, statement)), row].slice(-MAX_REVIEWED_FACTS),
  };
}

export const isConfirmedFact = (r: FactReviews, statement: string) => r.confirmed.some((c) => sameFact(c, statement));
export const rejectedFact = (r: FactReviews, statement: string) => r.rejected.find((x) => sameFact(x.statement, statement)) ?? null;

const RISK =
  /\b(complaints?|complain(?:ed|ing|s)?|scams?|scamm(?:ed|ers?|ing)|frauds?|fraudulent|defraud(?:ed|ing)?|cheat(?:ed|ing|s)?|rip[- ]?offs?|lawsuits?|sued|suing|legal (?:action|notice|case|dispute)s?|court (?:case|order)s?|consumer (?:court|forum)|payment (?:dispute|issue|problem|delay)s?|non[- ]?payment|unpaid (?:dues|wages|salar(?:y|ies)|invoices?)|(?:not|never) (?:paid|been paid)|refund (?:dispute|issue|problem|complaint)s?|chargebacks?|(?:negative|bad|poor|mixed) reviews?|blacklist(?:ed)?|police (?:complaint|case)s?|ponzi|money laundering|not (?:legit|legitimate|trustworthy)|untrustworthy|fake (?:reviews?|company|business|jobs?))\b/i;

/** True when a statement is about complaints, payment disputes, scams, fraud, lawsuits and the like. */
export function isReputationRisk(statement: string): boolean {
  return RISK.test(statement);
}

/**
 * Statements to show from ONE check's metrics.brandKnowledge, minus the ones the owner already decided on.
 *   - bk-3+ probes store `claims` ({claim, status}) — both unconfirmed statements and conflicts;
 *   - bk-1/bk-2 stored only `inaccuracies`, which included TRUE facts (the founder's name, the office address)
 *     whenever the business details were empty — so they are shown as "not confirmed", never as wrong.
 * Sample (simulated) checks are ignored.
 */
export function factsToCheck(metrics: unknown, reviews: FactReviews = { confirmed: [], rejected: [] }, max = 12): FactToCheck[] {
  const m = metrics && typeof metrics === "object" ? (metrics as { brandKnowledge?: unknown; simulated?: unknown }) : null;
  if (!m || m.simulated === true || !Array.isArray(m.brandKnowledge)) return [];
  const out: FactToCheck[] = [];
  const push = (engine: string, raw: unknown, status: FactStatus) => {
    const statement = clean(raw);
    if (!statement) return;
    if (isConfirmedFact(reviews, statement) || rejectedFact(reviews, statement)) return;
    const dup = out.find((f) => sameFact(f.statement, statement));
    if (dup) {
      if (status === "conflict") dup.status = "conflict";
      return;
    }
    out.push({ engine, statement, status, risk: isReputationRisk(statement) });
  };
  for (const b of m.brandKnowledge) {
    if (!b || typeof b !== "object") continue;
    const row = b as { provider?: unknown; claims?: unknown; inaccuracies?: unknown; version?: unknown };
    const engine = typeof row.provider === "string" ? row.provider : "";
    if (/simulat/i.test(engine)) continue;
    if (Array.isArray(row.claims)) {
      for (const c of row.claims) {
        if (!c || typeof c !== "object") continue;
        const cl = c as { claim?: unknown; status?: unknown };
        push(engine, cl.claim, cl.status === "conflict" ? "conflict" : "not_confirmed");
      }
    } else if (Array.isArray(row.inaccuracies)) {
      // Older checks: shown as "Not confirmed" — the audit found true facts (founder, address) listed as "wrong" there.
      for (const s of row.inaccuracies) push(engine, s, "not_confirmed");
    }
  }
  // Risks first inside their own box; the page splits on `risk`.
  return out.slice(0, max);
}

export interface ProbedRun<T> {
  run: T;
  facts: FactToCheck[];
}

/**
 * The list always comes from the NEWEST finished check that asked AI tools about the business (its metrics carry
 * `brandKnowledge`), even when that check found nothing to show — never from an older check that happened to have
 * statements. `runs` must be newest first.
 */
export function latestProbedRun<T extends { status: string; metrics: unknown }>(runs: T[], reviews?: FactReviews): ProbedRun<T> | null {
  for (const run of runs) {
    if (run.status !== "succeeded" && run.status !== "succeeded_with_warnings") continue;
    const m = run.metrics && typeof run.metrics === "object" ? (run.metrics as { brandKnowledge?: unknown; simulated?: unknown }) : null;
    if (!m || m.simulated === true || !Array.isArray(m.brandKnowledge) || m.brandKnowledge.length === 0) continue;
    return { run, facts: factsToCheck(run.metrics, reviews) };
  }
  return null;
}

/** Title of the To-do task created by "✗ Wrong" (fits the task title limit of 200). */
export function wrongFactTaskTitle(statement: string): string {
  const prefix = "Correct what AI says: ";
  const s = clean(statement);
  const room = 200 - prefix.length;
  return prefix + (s.length > room ? `${s.slice(0, room - 1)}…` : s);
}

/** Description of that task: what was said, what is right (if given) and where to fix it. */
export function wrongFactTaskDescription(o: { statement: string; toolName?: string; correction?: string }): string {
  const who = o.toolName ? `${o.toolName} said` : "An AI tool said";
  const right = clean(o.correction, 300);
  return [
    `${who}: “${clean(o.statement)}”. You told us this is wrong.`,
    right ? `What is right: ${right}` : "",
    "How to correct it: 1) Put the right fact clearly on your website (About or Contact page). 2) Make it the same on your Google Business Profile and every directory that lists you. 3) If another website has the wrong fact, ask them to fix it. AI tools pick up the change over the next few checks.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
