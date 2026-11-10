"use client";
// One tracked keyword's Google position over time (axis reversed so "up" = better). Gaps = not in the top 100.
import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Notice, Skeleton } from "@/components/ui";

interface Point {
  checkedAt: string;
  position: number | null;
}

const axis = { stroke: "var(--chart-grid)", tick: { fill: "var(--muted)", fontSize: 12 }, tickLine: false, axisLine: false } as const;
const short = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export function RankHistoryChart({ projectId, keywordId, keyword }: { projectId: string; keywordId: string; keyword: string }) {
  const [points, setPoints] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/projects/${projectId}/rankings?keywordId=${encodeURIComponent(keywordId)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error?.message ?? "Couldn't load the history.");
        if (live) setPoints(Array.isArray(j?.points) ? (j.points as Point[]) : []);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [projectId, keywordId]);

  if (error) return <Notice tone="danger">{error}</Notice>;
  if (!points) return <Skeleton className="h-44 w-full" />;
  if (points.length === 0) return <Notice tone="neutral">No checks yet for “{keyword}”. The first one runs within a few minutes of adding it.</Notice>;

  const data = points.map((p) => ({ label: short(p.checkedAt), position: p.position }));
  const ranked = points.map((p) => p.position).filter((p): p is number => p !== null);
  const maxPos = ranked.length ? Math.min(100, Math.max(10, Math.ceil(Math.max(...ranked) / 10) * 10)) : 10;
  const described = data.map((d) => `${d.label} ${d.position ?? "not in top 100"}`).join(", ");

  return (
    <div className="space-y-2">
      <div className="text-caption uppercase tracking-wider text-muted">Google position for “{keyword}” (higher on the chart = better)</div>
      <div style={{ height: 180 }} role="img" aria-label={`Position history for ${keyword}: ${described}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" {...axis} minTickGap={24} />
            <YAxis reversed domain={[1, maxPos]} allowDecimals={false} {...axis} width={40} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" }}
              labelStyle={{ color: "var(--muted)" }}
              formatter={(v) => [v == null ? "not in top 100" : `#${v}`, "Position"]}
            />
            <Line
              type="monotone"
              dataKey="position"
              name="Position"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={data.length <= 20 ? { r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-1)" } : false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {ranked.length < points.length && <p className="text-xs text-muted">Gaps in the line are checks where you weren&apos;t in Google&apos;s top 100.</p>}
    </div>
  );
}
