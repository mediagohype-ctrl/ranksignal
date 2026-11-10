// Flat, one-row-per-day series for Looker Studio and spreadsheets (pure; no I/O).
// Scores and AI rates are "as of the end of that day": the latest measurement taken on or before the day, carried
// forward until the next one (null before the first). Search Console columns are that exact day's totals, or null
// when no data was stored for the day. Nothing is interpolated or invented.
import type { SnapshotView } from "@/lib/snapshots/types";

export interface LookerRow {
  date: string; // YYYY-MM-DD (UTC)
  overall_score: number | null;
  seo_score: number | null;
  aeo_score: number | null;
  geo_score: number | null;
  brand_score: number | null;
  ai_mention_rate: number | null; // 0–1
  ai_citation_rate: number | null; // 0–1
  ai_recommendation_rate: number | null; // 0–1
  issues_open: number | null;
  gsc_clicks: number | null;
  gsc_impressions: number | null;
  gsc_ctr: number | null; // 0–1
  gsc_position: number | null;
}

export const LOOKER_FIELDS: { name: keyof LookerRow; label: string; type: "date" | "number" | "percent"; description: string }[] = [
  { name: "date", label: "Date", type: "date", description: "Day (UTC)" },
  { name: "overall_score", label: "Overall score", type: "number", description: "0–100, latest website check on or before the day" },
  { name: "seo_score", label: "SEO score", type: "number", description: "0–100" },
  { name: "aeo_score", label: "AEO score", type: "number", description: "0–100" },
  { name: "geo_score", label: "GEO score", type: "number", description: "0–100" },
  { name: "brand_score", label: "Brand score", type: "number", description: "0–100" },
  { name: "ai_mention_rate", label: "AI mention rate", type: "percent", description: "Share of AI answers that named the business (0–1)" },
  { name: "ai_citation_rate", label: "AI citation rate", type: "percent", description: "Share of AI answers that linked the website (0–1)" },
  { name: "ai_recommendation_rate", label: "AI recommendation rate", type: "percent", description: "Share of AI answers that recommended the business (0–1)" },
  { name: "issues_open", label: "Open issues", type: "number", description: "Open website issues at the latest check" },
  { name: "gsc_clicks", label: "Search clicks", type: "number", description: "Google Search Console clicks that day" },
  { name: "gsc_impressions", label: "Search impressions", type: "number", description: "Google Search Console impressions that day" },
  { name: "gsc_ctr", label: "Search CTR", type: "percent", description: "Clicks ÷ impressions that day (0–1)" },
  { name: "gsc_position", label: "Average position", type: "number", description: "Average Google position that day" },
];

export interface GscDay {
  date: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
}

const DAY_MS = 86_400_000;
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** `snapshots` in any order (non-simulated only); may include ones before `from` for the carried-forward start. */
export function buildLookerRows(snapshots: SnapshotView[], gsc: GscDay[], from: string, to: string): LookerRow[] {
  const snaps = [...snapshots].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const gscByDate = new Map(gsc.map((g) => [g.date, g]));
  const state = {
    overall: null as number | null,
    pillars: { seo: null, aeo: null, geo: null, brand: null } as Record<"seo" | "aeo" | "geo" | "brand", number | null>,
    issues: null as number | null,
    mention: null as number | null,
    citation: null as number | null,
    recommendation: null as number | null,
  };
  let i = 0;
  const rows: LookerRow[] = [];
  for (const date of datesBetween(from, to)) {
    const endOfDay = Date.parse(`${date}T00:00:00Z`) + DAY_MS;
    while (i < snaps.length && snaps[i].createdAt.getTime() < endOfDay) {
      const s = snaps[i++];
      if (s.overallScore !== null) state.overall = s.overallScore;
      for (const k of ["seo", "aeo", "geo", "brand"] as const) if (s.pillarScores[k] !== null) state.pillars[k] = s.pillarScores[k];
      if (s.openIssues) state.issues = s.openIssues.total;
      if (s.visibility && s.visibility.collected > 0) {
        state.mention = round(s.visibility.mentionRate, 4);
        state.citation = round(s.visibility.citationRate, 4);
        state.recommendation = round(s.visibility.recommendationRate, 4);
      }
    }
    const g = gscByDate.get(date);
    rows.push({
      date,
      overall_score: state.overall,
      seo_score: state.pillars.seo,
      aeo_score: state.pillars.aeo,
      geo_score: state.pillars.geo,
      brand_score: state.pillars.brand,
      ai_mention_rate: state.mention,
      ai_citation_rate: state.citation,
      ai_recommendation_rate: state.recommendation,
      issues_open: state.issues,
      gsc_clicks: g?.clicks ?? null,
      gsc_impressions: g?.impressions ?? null,
      gsc_ctr: g ? (g.ctr ?? (g.clicks !== null && g.impressions ? round(g.clicks / g.impressions, 4) : null)) : null,
      gsc_position: g?.position !== null && g?.position !== undefined ? round(g.position, 2) : null,
    });
  }
  return rows;
}
