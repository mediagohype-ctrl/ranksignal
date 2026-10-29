// Plain-English Markdown export of a monthly impact report (downloadable).
import { TYPE_LABEL, asType } from "@/lib/offsite/types";
import type { MonthlyReportPayload, RateTriple } from "./types";

const esc = (s: string) => s.replace(/([\\`*_[\]<>|])/g, "\\$1");
const pct = (n: number | null | undefined) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "—");
const num = (n: number | null | undefined) => (typeof n === "number" ? String(n) : "—");
const signed = (n: number | null | undefined, unit = "") =>
  typeof n === "number" ? `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}${unit}` : "—";
const signedPp = (n: number | null | undefined) => (typeof n === "number" ? signed(Math.round(n * 100), " pts") : "—");
const date = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "—");

function rateRow(label: string, s: RateTriple | null | undefined, e: RateTriple | null | undefined, k: keyof RateTriple) {
  const a = s?.[k] ?? null;
  const b = e?.[k] ?? null;
  return `| ${label} | ${pct(a)} | ${pct(b)} | ${a !== null && b !== null ? signedPp(b - a) : "—"} |`;
}

export function monthlyReportToMarkdown(p: MonthlyReportPayload, summary: string): string {
  const L: string[] = [];
  L.push(`# ${esc(p.periodLabel)} impact report — ${esc(p.project.name)}`, "");
  L.push(`**Website:** ${p.project.websiteUrl}  `, `**Period:** ${date(p.range.start)} to ${date(new Date(new Date(p.range.end).getTime() - 1).toISOString())} (UTC)  `, `**Generated:** ${date(p.generatedAt)}`, "");
  L.push("## Summary", "", esc(summary), "");

  const h = p.headline;
  if (h.gains.length) L.push("### Gains", "", ...h.gains.map((g) => `- ${esc(g)}`), "");
  if (h.risks.length) L.push("### Risks", "", ...h.risks.map((g) => `- ${esc(g)}`), "");
  if (h.nextActions.length) L.push("### Next actions", "", ...h.nextActions.map((g) => `- ${esc(g)}`), "");

  L.push("## Scores", "", "| Area | Start | End | Change |", "|---|---|---|---|");
  L.push(`| **Overall** | ${num(p.scores.start.overall)} | ${num(p.scores.end.overall)} | ${signed(p.scores.overallDelta)} |`);
  for (const x of p.scores.pillars) L.push(`| ${x.label} | ${num(x.start)} | ${num(x.end)} | ${signed(x.delta)} |`);
  L.push("", `_Start: ${date(p.scores.start.at)} · End: ${date(p.scores.end.at)}_`, "");

  const v = p.aiVisibility;
  L.push("## AI visibility", "");
  if (!v.measured) {
    L.push("Not measured with real AI answers this month.", "");
  } else {
    const s = v.likeForLike?.start ?? v.start;
    const e = v.likeForLike?.end ?? v.end;
    L.push(
      v.likeForLike
        ? `Compared on the ${v.likeForLike.prompts} questions asked in both checks (${v.likeForLike.start.answers} → ${v.likeForLike.end.answers} answers).`
        : `Based on ${v.end?.answers ?? 0} answers at the end of the month.`,
      "",
      "| Measure | Start | End | Change |",
      "|---|---|---|---|",
      rateRow("Mentioned", s, e, "mentionRate"),
      rateRow("Website cited", s, e, "citationRate"),
      rateRow("Recommended", s, e, "recommendationRate"),
      "",
    );
    if (v.engines.length) {
      L.push("### By AI engine", "", "| Engine | Mentioned (start → end) | Cited (start → end) | Answers |", "|---|---|---|---|");
      for (const r of v.engines) {
        L.push(`| ${esc(r.engine)} | ${pct(r.start?.mentionRate)} → ${pct(r.end?.mentionRate)} | ${pct(r.start?.citationRate)} → ${pct(r.end?.citationRate)} | ${r.start?.answers ?? 0} → ${r.end?.answers ?? 0} |`);
      }
      L.push("");
    }
    if (v.competitorShare.length) {
      L.push("### Share of AI mentions", "", "| Brand | Start | End | Change |", "|---|---|---|---|");
      for (const c of v.competitorShare) L.push(`| ${c.isBrand ? `**${esc(c.name)}** (you)` : esc(c.name)} | ${pct(c.start)} | ${pct(c.end)} | ${signedPp(c.delta)} |`);
      L.push("");
    }
    if (v.promptsWon.length) L.push("### Questions where you're now mentioned", "", ...v.promptsWon.map((x) => `- ${esc(x.prompt)}`), "");
    if (v.promptsLost.length) {
      L.push("### Questions where you're no longer mentioned", "", ...v.promptsLost.map((x) => `- ${esc(x.prompt)}${x.competitors.length ? ` (mentioned instead: ${esc(x.competitors.join(", "))})` : ""}`), "");
    }
  }

  const sr = p.search;
  if (sr && (sr.gsc || sr.ga4)) {
    const signedPct = (x: { pct: number | null }) => (x.pct === null ? "new" : signed(Math.round(x.pct * 100), "%"));
    L.push("## Google search", "", "| Measure | Last month | This month | Change |", "|---|---|---|---|");
    if (sr.gsc) {
      L.push(`| Clicks from Google (Search Console) | ${sr.gsc.clicks.previous} | ${sr.gsc.clicks.current} | ${signedPct(sr.gsc.clicks)} |`);
      L.push(`| Times shown in Google (impressions) | ${sr.gsc.impressions.previous} | ${sr.gsc.impressions.current} | ${signedPct(sr.gsc.impressions)} |`);
    }
    if (sr.ga4) {
      L.push(`| Website visits (GA4 sessions) | ${sr.ga4.sessions.previous} | ${sr.ga4.sessions.current} | ${signedPct(sr.ga4.sessions)} |`);
      L.push(`| Visits from AI assistants (GA4) | ${sr.ga4.aiSessions.previous} | ${sr.ga4.aiSessions.current} | ${signedPct(sr.ga4.aiSessions)} |`);
    }
    L.push("");
    if (sr.gsc?.queriesWon.length) L.push("### New searches bringing clicks", "", ...sr.gsc.queriesWon.map((q) => `- ${esc(q.query)} (${q.clicks} clicks)`), "");
    if (sr.ga4?.aiBySource.length) L.push("### Visits by AI assistant", "", ...sr.ga4.aiBySource.map((a) => `- ${esc(a.label)}: ${a.previousSessions} → ${a.sessions}`), "");
    L.push(`_${esc(sr.note)}_`, "");
  }

  L.push("## Website issues", "", `- Fixed this month: **${p.issues.fixed.total}**`, `- New this month: **${p.issues.new.total}**`);
  const o = p.issues.openBySeverity;
  L.push(`- Still open: **${o.total}** (critical ${o.critical}, high ${o.high}, medium ${o.medium}, low ${o.low})`, "");
  if (p.issues.fixed.top.length) L.push("Fixed:", "", ...p.issues.fixed.top.map((i) => `- ${esc(i.title)} (${i.count})`), "");
  if (p.issues.new.top.length) L.push("New:", "", ...p.issues.new.top.map((i) => `- [${i.severity}] ${esc(i.title)} (${i.count})`), "");

  L.push("## Work shipped", "");
  if (!p.work.shipped.length) L.push("Nothing was marked as shipped this month.", "");
  else L.push(...p.work.shipped.map((w) => `- ${date(w.completedAt)} — ${esc(w.title)} (${w.performedBy === "agency" ? "by us" : w.performedBy === "client" ? "by you" : "automatic"})${w.url ? ` — ${w.url}` : ""}`), "");

  if (p.offsite && p.offsite.count > 0) {
    L.push("## Off-site work", "", `${p.offsite.count} off-site ${p.offsite.count === 1 ? "item" : "items"} went live this month.`, "");
    L.push(...p.offsite.live.map((x) => `- ${esc(x.name)} (${esc(TYPE_LABEL[asType(x.type)])})${x.url ? ` — ${x.url}` : ""}`), "");
  }

  L.push("## Next month's plan", "");
  if (!p.nextMonth.length) L.push("No open items yet.", "");
  else L.push(...p.nextMonth.map((n) => `- ${esc(n.title)}${n.source === "report" ? " _(from the site report)_" : n.dueAt ? ` _(due ${date(n.dueAt)})_` : ""}`), "");

  if (p.wrongAnswers.length) {
    L.push("## Wrong things AI assistants said about you", "", ...p.wrongAnswers.map((w) => `- ${esc(w.engine)}: ${esc(w.statement)}`), "");
  }

  L.push("## How to read this report", "", esc(p.attribution), "");
  if (p.notes.length) L.push("### Notes", "", ...p.notes.map((n) => `- ${esc(n)}`), "");
  return L.join("\n");
}
