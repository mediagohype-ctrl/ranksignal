"use client";
// Score history chart + snapshot table with a "show simulated" toggle (simulated runs hidden by default).
import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { ScoreHistoryChart, type HistoryMarker, type ScoreHistoryPoint, type ShippedMarker } from "@/components/app/charts";
import { Badge, Button, EmptyState, Table, TD, TH, THead, TR } from "@/components/ui";

export interface HistorySnapshotRow {
  id: string;
  kind: "crawl" | "visibility";
  at: string; // ISO
  crawlRunId: string | null;
  overall: number | null;
  grade: string | null;
  seo: number | null;
  aeo: number | null;
  geo: number | null;
  brand: number | null;
  openIssues: number | null;
  mentionRate: number | null;
  citationRate: number | null;
  sampleSize: number | null;
  promptSetVersion: number | null;
  methodologyVersion: string;
  simulated: boolean;
}

export interface ShippedChange {
  at: string; // ISO
  title: string;
}

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dayKey = (iso: string) => iso.slice(0, 10);

export function HistoryExplorer({ snapshots, shipped }: { snapshots: HistorySnapshotRow[]; shipped: ShippedChange[] }) {
  const [showSimulated, setShowSimulated] = useState(false);
  const simulatedCount = snapshots.filter((s) => s.simulated).length;
  const rows = useMemo(() => snapshots.filter((s) => showSimulated || !s.simulated), [snapshots, showSimulated]);

  const { points, markers } = useMemo(() => {
    const pts: ScoreHistoryPoint[] = [];
    const mks: HistoryMarker[] = [];
    const seenCrawl = new Set<string>();
    let prevMethod: string | null = null;
    let prevPromptSet: number | null = null;
    for (const s of rows) {
      const t = new Date(s.at).getTime();
      if (prevMethod !== null && s.methodologyVersion !== prevMethod) mks.push({ t, kind: "methodology", label: "Scoring method changed" });
      prevMethod = s.methodologyVersion;
      if (s.promptSetVersion !== null) {
        if (prevPromptSet !== null && s.promptSetVersion !== prevPromptSet) mks.push({ t, kind: "prompt_set", label: `Questions changed (v${s.promptSetVersion})` });
        prevPromptSet = s.promptSetVersion;
      }
      // One point per website scan: visibility snapshots carry copied crawl scores, so skip repeats.
      if (s.overall === null && s.seo === null) continue;
      const key = s.crawlRunId ?? s.id;
      if (seenCrawl.has(key)) continue;
      seenCrawl.add(key);
      pts.push({ t, overall: s.overall, seo: s.seo, aeo: s.aeo, geo: s.geo, brand: s.brand });
    }
    return { points: pts, markers: mks };
  }, [rows]);

  const shippedMarkers = useMemo<ShippedMarker[]>(() => {
    const byDay = new Map<string, ShippedMarker>();
    for (const c of shipped) {
      const k = dayKey(c.at);
      const cur = byDay.get(k);
      if (cur) cur.count++;
      else byDay.set(k, { t: new Date(`${k}T12:00:00Z`).getTime(), count: 1, label: c.title });
    }
    return [...byDay.values()];
  }, [shipped]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 sm:px-6">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption font-normal text-muted" aria-label="Chart key">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-fg-soft" /> Changes shipped ({shipped.length})
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-0 border-l-2 border-dashed border-warning" /> AI questions changed
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-0 border-l-2 border-dashed border-muted" /> Scoring method changed
          </li>
        </ul>
        {simulatedCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            icon={<FlaskConical />}
            aria-pressed={showSimulated}
            onClick={() => setShowSimulated((v) => !v)}
          >
            {showSimulated ? "Hide simulated checks" : `Show simulated checks (${simulatedCount})`}
          </Button>
        )}
      </div>

      <div className="px-5 sm:px-6">
        {points.length === 0 ? (
          <EmptyState size="sm" title="No scores yet" description="Scores appear here after your first completed website scan." />
        ) : (
          <ScoreHistoryChart data={points} markers={markers} shipped={shippedMarkers} />
        )}
        {points.length === 1 && <p className="mt-2 text-caption font-normal text-muted">One scan so far — the lines start after your next scan.</p>}
      </div>

      {rows.length > 0 && (
        <Table caption="Measurement snapshots, newest first" zebra maxHeight="28rem" stickyHeader>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Measured</TH>
              <TH align="right">Overall</TH>
              <TH align="right">SEO</TH>
              <TH align="right">AEO</TH>
              <TH align="right">GEO</TH>
              <TH align="right">Brand</TH>
              <TH align="right">Open issues</TH>
              <TH align="right">Mentioned</TH>
              <TH align="right">Linked</TH>
              <TH>Notes</TH>
            </tr>
          </THead>
          <tbody>
            {[...rows].reverse().map((s) => (
              <TR key={s.id}>
                <TD className="whitespace-nowrap">{day(s.at)}</TD>
                <TD className="whitespace-nowrap">{s.kind === "crawl" ? "Website scan" : "AI check"}</TD>
                <TD numeric className="font-medium text-fg">
                  {s.overall ?? "—"}
                  {s.grade ? <span className="text-muted"> {s.grade}</span> : null}
                </TD>
                <TD numeric>{s.seo ?? "—"}</TD>
                <TD numeric>{s.aeo ?? "—"}</TD>
                <TD numeric>{s.geo ?? "—"}</TD>
                <TD numeric>{s.brand ?? "—"}</TD>
                <TD numeric>{s.openIssues ?? "—"}</TD>
                <TD numeric>{pct(s.mentionRate)}</TD>
                <TD numeric>{pct(s.citationRate)}</TD>
                <TD>
                  <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {s.promptSetVersion !== null && <span>questions v{s.promptSetVersion}</span>}
                    {s.sampleSize ? <span>· {s.sampleSize} answers</span> : null}
                    {s.simulated && (
                      <Badge tone="warning" size="sm">
                        simulated
                      </Badge>
                    )}
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
