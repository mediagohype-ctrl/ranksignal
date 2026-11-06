"use client";
// Score history chart + snapshot table with a "show simulated" toggle (simulated runs hidden by default).
// Plain mode (brief 5.7): one line — the overall score, same number as Home — with a dot for each fix that went
// live. Expert mode adds the four parts of the score and the table of every check.
import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { ScoreHistoryChart, type ShippedMarker } from "@/components/app/charts";
import { buildScorePoints } from "./score-points";
import { Badge, Button, EmptyState, Table, TD, TH, THead, TR } from "@/components/ui";
import { fmtDate } from "@/lib/dashboard/format";

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
const day = (iso: string) => fmtDate(iso);
const dayKey = (iso: string) => iso.slice(0, 10);

export function HistoryExplorer({
  snapshots,
  shipped,
  expert = false,
}: {
  snapshots: HistorySnapshotRow[];
  shipped: ShippedChange[];
  expert?: boolean;
}) {
  const [showSimulated, setShowSimulated] = useState(false);
  const simulatedCount = snapshots.filter((s) => s.simulated).length;
  const rows = useMemo(() => snapshots.filter((s) => showSimulated || !s.simulated), [snapshots, showSimulated]);

  const { points, markers } = useMemo(() => buildScorePoints(rows), [rows]);

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
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-fg-soft" /> Fixes that went live ({shipped.length})
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
            {showSimulated ? "Hide sample checks" : `Show sample checks (${simulatedCount})`}
          </Button>
        )}
      </div>

      <div className="px-5 sm:px-6">
        {points.length === 0 ? (
          <EmptyState size="sm" title="No scores yet" description="Scores appear here after your first finished website check." />
        ) : (
          <ScoreHistoryChart data={points} markers={markers} shipped={shippedMarkers} onlyOverall={!expert} />
        )}
        {points.length === 1 && <p className="mt-2 text-caption font-normal text-muted">One check so far — the lines start after your next check.</p>}
      </div>

      {expert && rows.length > 0 && (
        <Table caption="Scores after each check, newest first" zebra maxHeight="28rem" stickyHeader>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Check</TH>
              <TH align="right">Overall</TH>
              <TH align="right">SEO</TH>
              <TH align="right">AEO</TH>
              <TH align="right">GEO</TH>
              <TH align="right">Brand</TH>
              <TH align="right">Problems to fix</TH>
              <TH align="right">Named you</TH>
              <TH align="right">Linked to your site</TH>
              <TH>Notes</TH>
            </tr>
          </THead>
          <tbody>
            {[...rows].reverse().map((s) => (
              <TR key={s.id}>
                <TD className="whitespace-nowrap">{day(s.at)}</TD>
                <TD className="whitespace-nowrap">{s.kind === "crawl" ? "Website check" : "AI check"}</TD>
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
                    {s.promptSetVersion !== null && <span>question list v{s.promptSetVersion}</span>}
                    {s.sampleSize ? <span>· {s.sampleSize} {s.sampleSize === 1 ? "answer" : "answers"}</span> : null}
                    {s.simulated && (
                      <Badge tone="warning" size="sm">
                        sample
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
