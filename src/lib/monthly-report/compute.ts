// Pure math for the monthly impact report (unit-tested). No DB, no network.
import type {
  CompetitorShareRow, EngineRow, IssueLine, MonthlyReportPayload, MonthlyReportStatus, PillarDelta, PlanLine, PromptChange, RateTriple,
} from "./types";

export const PILLARS = [
  { pillar: "seo", label: "SEO" },
  { pillar: "aeo", label: "AEO (answer engines)" },
  { pillar: "geo", label: "GEO (generative AI)" },
  { pillar: "brand", label: "Brand" },
] as const;
type PillarKey = (typeof PILLARS)[number]["pillar"];

const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
type Severity = (typeof SEVERITIES)[number];

// ---- snapshots ---------------------------------------------------------------------------------------------------

/** Normalised snapshot (decoupled from the history module's exact view shape). */
export interface Snap {
  at: Date;
  overall: number | null;
  grade: string | null;
  pillars: Partial<Record<PillarKey, number | null>>;
  simulated: boolean;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Reads a SnapshotView (or a raw ReportSnapshot row) defensively. Returns null when it has no timestamp. */
export function normalizeSnapshot(v: unknown): Snap | null {
  const o = rec(v);
  const atRaw = o.createdAt ?? o.at ?? o.takenAt;
  const at = atRaw instanceof Date ? atRaw : typeof atRaw === "string" ? new Date(atRaw) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  const overallObj = rec(o.overall);
  const pillarSrc = rec(o.pillarScores ?? o.pillars);
  const pillars: Snap["pillars"] = {};
  for (const { pillar } of PILLARS) {
    const p = pillarSrc[pillar];
    pillars[pillar] = num(p) ?? num(rec(p).score);
  }
  return {
    at,
    overall: num(o.overallScore) ?? num(overallObj.score),
    grade: typeof o.grade === "string" ? o.grade : typeof overallObj.grade === "string" ? overallObj.grade : null,
    pillars,
    simulated: o.simulated === true,
  };
}

/**
 * Start = the latest snapshot at/before the period start (the baseline) when one exists, else the first snapshot
 * inside the period. End = the latest snapshot inside the period. Simulated snapshots are ignored.
 */
export function pickStartEnd(
  snaps: Snap[],
  range: { start: Date; end: Date },
): { start: Snap | null; end: Snap | null; baselineFromPreviousPeriod: boolean } {
  const real = snaps.filter((s) => !s.simulated).sort((a, b) => a.at.getTime() - b.at.getTime());
  const before = real.filter((s) => s.at.getTime() <= range.start.getTime());
  const inside = real.filter((s) => s.at.getTime() > range.start.getTime() && s.at.getTime() < range.end.getTime());
  const end = inside.at(-1) ?? null;
  const baseline = before.at(-1) ?? null;
  if (baseline) return { start: baseline, end, baselineFromPreviousPeriod: true };
  const first = inside[0] ?? null;
  // A single snapshot inside the month is the end state; there is nothing to compare it with.
  return { start: first && first !== end ? first : null, end, baselineFromPreviousPeriod: false };
}

export const delta = (a: number | null | undefined, b: number | null | undefined): number | null =>
  typeof a === "number" && typeof b === "number" ? Math.round((b - a) * 10000) / 10000 : null;

export function scoreDeltas(start: Snap | null, end: Snap | null): { overallDelta: number | null; pillars: PillarDelta[] } {
  return {
    overallDelta: delta(start?.overall, end?.overall),
    pillars: PILLARS.map(({ pillar, label }) => {
      const s = start?.pillars[pillar] ?? null;
      const e = end?.pillars[pillar] ?? null;
      return { pillar, label, start: s, end: e, delta: delta(s, e) };
    }),
  };
}

// ---- AI visibility -------------------------------------------------------------------------------------------------

export interface RunObs {
  promptId: string;
  promptText: string;
  engine: string;
  mentioned: boolean;
  cited: boolean;
  recommended: boolean;
  competitorMentions: Record<string, number>;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

export function rates(obs: RunObs[]): RateTriple & { answers: number } {
  const n = obs.length;
  const f = (k: "mentioned" | "cited" | "recommended") => (n ? r4(obs.filter((o) => o[k]).length / n) : null);
  return { answers: n, mentionRate: f("mentioned"), citationRate: f("cited"), recommendationRate: f("recommended") };
}

const pairKey = (o: RunObs) => `${o.promptId}\u0000${o.engine}`;

/** Rates restricted to (prompt, engine) pairs present in both runs. Null when nothing overlaps. */
export function likeForLike(startObs: RunObs[], endObs: RunObs[]): MonthlyReportPayload["aiVisibility"]["likeForLike"] {
  const startKeys = new Set(startObs.map(pairKey));
  const endKeys = new Set(endObs.map(pairKey));
  const s = startObs.filter((o) => endKeys.has(pairKey(o)));
  const e = endObs.filter((o) => startKeys.has(pairKey(o)));
  if (!s.length || !e.length) return null;
  return { prompts: new Set(s.map((o) => o.promptId)).size, start: rates(s), end: rates(e) };
}

export function engineRows(startObs: RunObs[] | null, endObs: RunObs[] | null): EngineRow[] {
  const engines = new Set([...(startObs ?? []), ...(endObs ?? [])].map((o) => o.engine));
  return [...engines].sort().map((engine) => {
    const s = startObs?.filter((o) => o.engine === engine) ?? [];
    const e = endObs?.filter((o) => o.engine === engine) ?? [];
    return { engine, start: s.length ? rates(s) : null, end: e.length ? rates(e) : null };
  });
}

/** Share of all brand+competitor answer-mentions (presence per answer), mirroring visibility metrics. */
export function shareOf(obs: RunObs[], brand: string): Map<string, number> {
  const counts = new Map<string, number>();
  const brandMentions = obs.filter((o) => o.mentioned).length;
  if (brandMentions) counts.set(brand, brandMentions);
  const brandLc = brand.toLowerCase();
  for (const o of obs) {
    for (const [name, n] of Object.entries(o.competitorMentions)) {
      if (n > 0 && name.toLowerCase() !== brandLc && name !== "__brand__") counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return new Map([...counts].map(([k, v]) => [k, total ? r4(v / total) : 0]));
}

export function competitorShareRows(startObs: RunObs[] | null, endObs: RunObs[] | null, brand: string, max = 6): CompetitorShareRow[] {
  const s = startObs ? shareOf(startObs, brand) : null;
  const e = endObs ? shareOf(endObs, brand) : null;
  const names = new Set([...(s?.keys() ?? []), ...(e?.keys() ?? [])]);
  names.add(brand);
  const rows = [...names].map((name) => {
    const start = s ? (s.get(name) ?? 0) : null;
    const end = e ? (e.get(name) ?? 0) : null;
    return { name, isBrand: name === brand, start, end, delta: delta(start, end) };
  });
  const brandRow = rows.find((r) => r.isBrand)!;
  const others = rows
    .filter((r) => !r.isBrand)
    .sort((a, b) => (b.end ?? b.start ?? 0) - (a.end ?? a.start ?? 0) || a.name.localeCompare(b.name))
    .slice(0, max - 1);
  return [brandRow, ...others];
}

/**
 * Prompts won / lost, matched by prompt id across two runs. A prompt counts as "mentioned" in a run when any
 * engine's answer mentioned the brand. Only prompts asked in both runs are compared.
 */
export function promptsWonLost(startObs: RunObs[], endObs: RunObs[], brand: string): { won: PromptChange[]; lost: PromptChange[] } {
  const group = (obs: RunObs[]) => {
    const m = new Map<string, { text: string; mentioned: boolean; competitors: Set<string> }>();
    for (const o of obs) {
      const g = m.get(o.promptId) ?? { text: o.promptText, mentioned: false, competitors: new Set<string>() };
      g.mentioned ||= o.mentioned;
      for (const [name, n] of Object.entries(o.competitorMentions)) {
        if (n > 0 && name.toLowerCase() !== brand.toLowerCase() && name !== "__brand__") g.competitors.add(name);
      }
      m.set(o.promptId, g);
    }
    return m;
  };
  const s = group(startObs);
  const e = group(endObs);
  const won: PromptChange[] = [];
  const lost: PromptChange[] = [];
  for (const [id, end] of e) {
    const start = s.get(id);
    if (!start) continue;
    const line = { promptId: id, prompt: end.text.slice(0, 300), competitors: [...end.competitors].sort().slice(0, 6) };
    if (!start.mentioned && end.mentioned) won.push(line);
    if (start.mentioned && !end.mentioned) lost.push(line);
  }
  const byText = (a: PromptChange, b: PromptChange) => a.prompt.localeCompare(b.prompt);
  return { won: won.sort(byText), lost: lost.sort(byText) };
}

// ---- issues ----------------------------------------------------------------------------------------------------------

export interface FindingRow {
  code: string;
  severity: string;
  message: string;
  status: string;
  detectedAt: Date;
  resolvedAt: Date | null;
}

const sevRank = (s: string) => {
  const i = SEVERITIES.indexOf(s as Severity);
  return i === -1 ? SEVERITIES.length : i;
};
const inRange = (d: Date | null, r: { start: Date; end: Date }) => !!d && d.getTime() >= r.start.getTime() && d.getTime() < r.end.getTime();

function groupLines(rows: FindingRow[], max: number): IssueLine[] {
  const m = new Map<string, IssueLine>();
  for (const f of rows) {
    const cur = m.get(f.code);
    if (cur) {
      cur.count++;
      if (sevRank(f.severity) < sevRank(cur.severity)) cur.severity = f.severity;
    } else {
      m.set(f.code, { code: f.code, title: f.message.split(/(?<=\.)\s/)[0]!.slice(0, 160), severity: f.severity, count: 1 });
    }
  }
  return [...m.values()].sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || b.count - a.count || a.code.localeCompare(b.code)).slice(0, max);
}

/**
 * Fixed = resolved during the period. New = first detected during the period. Open at end = detected before the
 * period end and not resolved/ignored by then (ignored findings are excluded entirely).
 */
export function classifyIssues(findings: FindingRow[], range: { start: Date; end: Date }, max = 6): MonthlyReportPayload["issues"] {
  const fixed = findings.filter((f) => f.status === "resolved" && inRange(f.resolvedAt, range));
  const fresh = findings.filter((f) => f.status !== "ignored" && inRange(f.detectedAt, range));
  const openAtEnd = findings.filter(
    (f) =>
      f.status !== "ignored" &&
      f.detectedAt.getTime() < range.end.getTime() &&
      (f.status === "open" || (f.resolvedAt !== null && f.resolvedAt.getTime() >= range.end.getTime())),
  );
  const openBySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
  for (const f of openAtEnd) {
    const s = (SEVERITIES as readonly string[]).includes(f.severity) ? (f.severity as Severity) : "info";
    openBySeverity[s]++;
    openBySeverity.total++;
  }
  return {
    fixed: { total: fixed.length, top: groupLines(fixed, max) },
    new: { total: fresh.length, top: groupLines(fresh, max) },
    openBySeverity,
  };
}

// ---- plan ----------------------------------------------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Open tasks first, then top report issues that no open task already covers (fuzzy title match). */
export function buildPlan(
  openWork: { title: string; status: string; category: string; dueAt?: Date | null }[],
  reportIssues: { title: string; impact: string }[],
  o: { maxTasks?: number; maxIssues?: number } = {},
): PlanLine[] {
  const tasks: PlanLine[] = openWork.slice(0, o.maxTasks ?? 10).map((t) => ({
    title: t.title, source: "task", status: t.status, category: t.category, dueAt: t.dueAt ? t.dueAt.toISOString() : null,
  }));
  const taskTitles = openWork.map((t) => norm(t.title)).filter(Boolean);
  const issues: PlanLine[] = reportIssues
    .filter((i) => {
      const n = norm(i.title);
      return n && !taskTitles.some((t) => t === n || t.includes(n) || n.includes(t));
    })
    .slice(0, o.maxIssues ?? 3)
    .map((i) => ({ title: i.title, source: "report", impact: i.impact }));
  return [...tasks, ...issues];
}

// ---- status --------------------------------------------------------------------------------------------------------

/** Done-for-you clients get a staff-reviewed draft; self-serve reports go out immediately. */
export function initialStatus(serviceTier: string | null | undefined): Extract<MonthlyReportStatus, "draft" | "sent"> {
  return serviceTier && serviceTier.trim() ? "draft" : "sent";
}

// ---- headline ------------------------------------------------------------------------------------------------------

const pts = (n: number) => `${Math.abs(Math.round(n))} point${Math.abs(Math.round(n)) === 1 ? "" : "s"}`;
const pp = (n: number) => `${Math.abs(Math.round(n * 100))} percentage point${Math.abs(Math.round(n * 100)) === 1 ? "" : "s"}`;
const pctStr = (n: number | null | undefined) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "—");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Up to 3 gains, 3 risks and 3 next actions, each stated from measured facts only. */
export function buildHeadline(p: Omit<MonthlyReportPayload, "headline" | "attribution">): MonthlyReportPayload["headline"] {
  const gains: string[] = [];
  const risks: string[] = [];
  const s = p.scores;
  if (s.overallDelta !== null && s.overallDelta > 0) gains.push(`Overall score up ${pts(s.overallDelta)} (${s.start.overall} → ${s.end.overall}).`);
  if (s.overallDelta !== null && s.overallDelta < 0) risks.push(`Overall score down ${pts(s.overallDelta)} (${s.start.overall} → ${s.end.overall}).`);

  const v = p.aiVisibility;
  const cmp = v.likeForLike ?? (v.start && v.end ? { start: v.start, end: v.end } : null);
  const md = cmp ? delta(cmp.start.mentionRate, cmp.end.mentionRate) : null;
  if (md !== null && md >= 0.01) gains.push(`Mentioned in more AI answers: ${pctStr(cmp!.start.mentionRate)} → ${pctStr(cmp!.end.mentionRate)} (+${pp(md)}).`);
  if (md !== null && md <= -0.01) risks.push(`Mentioned in fewer AI answers: ${pctStr(cmp!.start.mentionRate)} → ${pctStr(cmp!.end.mentionRate)} (−${pp(md)}).`);
  if (v.promptsWon.length) gains.push(`Now mentioned for ${plural(v.promptsWon.length, "question")} where AI assistants didn't mention you before.`);
  if (v.promptsLost.length) risks.push(`No longer mentioned for ${plural(v.promptsLost.length, "question")} where you appeared before.`);

  if (p.issues.fixed.total) gains.push(`${plural(p.issues.fixed.total, "website issue")} fixed this month.`);
  if (p.work.shipped.length) gains.push(`${plural(p.work.shipped.length, "piece")} of work shipped.`);
  const urgentNew = p.issues.new.top.filter((i) => i.severity === "critical" || i.severity === "high");
  if (urgentNew.length) risks.push(`New important issue${urgentNew.length === 1 ? "" : "s"} found: ${urgentNew.map((i) => i.title.replace(/\.$/, "")).slice(0, 2).join("; ")}.`);
  if (p.wrongAnswers.length) risks.push(`${plural(p.wrongAnswers.length, "inaccurate statement")} about your business in AI answers.`);
  const rival = v.competitorShare.find((c) => !c.isBrand && c.delta !== null && c.delta >= 0.05);
  if (rival) risks.push(`${rival.name} gained share of AI mentions (${pctStr(rival.start)} → ${pctStr(rival.end)}).`);
  const urgentOpen = p.issues.openBySeverity.critical + p.issues.openBySeverity.high;
  if (urgentOpen) risks.push(`${plural(urgentOpen, "critical or high-priority issue")} still open.`);

  const nextActions = p.nextMonth.slice(0, 3).map((l) => (l.source === "task" ? l.title : `Fix: ${l.title}`));
  if (nextActions.length < 3 && p.wrongAnswers.length) nextActions.push("Correct the inaccurate facts AI assistants repeat about your business.");
  if (nextActions.length < 3 && !v.measured) nextActions.push("Run an AI visibility check so next month's report can compare AI answers.");
  return { gains: gains.slice(0, 3), risks: risks.slice(0, 3), nextActions: nextActions.slice(0, 3) };
}

export const ATTRIBUTION_NOTE =
  "How to read this report: the changes above were measured during the same period as the work we list, but measured change " +
  "is correlation, not proof that a particular piece of work caused it. Search engines and AI assistants change constantly, " +
  "and AI answers vary from one run to the next even for the same question, so small moves can be noise. Nobody can guarantee " +
  "rankings, placement or mentions in AI answers; we report what we measured and what we shipped, honestly.";

/** Deterministic plain-English summary (fallback when no LLM is configured or it fails). 4–6 sentences. */
export function templateMonthlySummary(p: Omit<MonthlyReportPayload, "attribution">): string {
  const out: string[] = [];
  const s = p.scores;
  if (s.end.overall !== null && s.start.overall !== null) {
    const d = s.overallDelta ?? 0;
    out.push(
      `In ${p.periodLabel}, ${p.project.brand}'s overall website score ${d > 0 ? `rose from ${s.start.overall} to ${s.end.overall}` : d < 0 ? `fell from ${s.start.overall} to ${s.end.overall}` : `held steady at ${s.end.overall}`} out of 100.`,
    );
  } else if (s.end.overall !== null) {
    out.push(`In ${p.periodLabel}, ${p.project.brand}'s website scored ${s.end.overall} out of 100; this is the first measurement, so next month will show the change.`);
  } else {
    out.push(`In ${p.periodLabel}, we didn't have a completed website scan for ${p.project.brand}, so there's no score to compare.`);
  }
  out.push(
    p.work.shipped.length
      ? `We shipped ${plural(p.work.shipped.length, "piece")} of work, and ${plural(p.issues.fixed.total, "website issue")} ${p.issues.fixed.total === 1 ? "was" : "were"} resolved.`
      : `No work was marked as shipped this month; ${plural(p.issues.fixed.total, "website issue")} ${p.issues.fixed.total === 1 ? "was" : "were"} resolved.`,
  );
  const v = p.aiVisibility;
  if (v.end) {
    const cmp = v.likeForLike ?? (v.start ? { start: v.start, end: v.end } : null);
    out.push(
      cmp
        ? `AI assistants mentioned ${p.project.brand} in ${pctStr(cmp.end.mentionRate)} of sampled answers, compared with ${pctStr(cmp.start.mentionRate)} at the start of the month.`
        : `AI assistants mentioned ${p.project.brand} in ${pctStr(v.end.mentionRate)} of ${v.end.answers} sampled answers.`,
    );
  } else {
    out.push("We didn't have real AI answers from this month to measure AI visibility.");
  }
  if (v.promptsWon.length || v.promptsLost.length) {
    out.push(`You gained mentions for ${plural(v.promptsWon.length, "question")} and lost them for ${v.promptsLost.length}.`);
  }
  const urgent = p.issues.openBySeverity.critical + p.issues.openBySeverity.high;
  out.push(
    urgent
      ? `${plural(urgent, "important issue")} ${urgent === 1 ? "is" : "are"} still open, and next month's plan starts there.`
      : "There are no critical or high-priority issues open right now.",
  );
  return out.slice(0, 6).join(" ");
}
