"use client";
// One keyword over time: average position (its own chart, axis reversed so "up" = better) and clicks (separate chart;
// never a dual axis). Daily or weekly; data comes from stored Search Console rows.
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Notice, Skeleton, Tabs } from "@/components/ui";

interface Point {
  date: string;
  clicks: number;
  impressions: number;
  position: number | null;
}

const axis = { stroke: "var(--chart-grid)", tick: { fill: "var(--muted)", fontSize: 12 }, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" },
  labelStyle: { color: "var(--muted)" },
};
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function KeywordHistory({ projectId, query }: { projectId: string; query: string }) {
  const [granularity, setGranularity] = useState<"day" | "week">("day");
  const [points, setPoints] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setPoints(null);
    setError(null);
    const u = `/api/projects/${projectId}/keywords/history?days=90&granularity=${granularity}&query=${encodeURIComponent(query)}`;
    fetch(u, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error?.message ?? "Couldn't load the history.");
        if (live) setPoints(j.points as Point[]);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [projectId, query, granularity]);

  const data = (points ?? []).map((p) => ({ ...p, label: granularity === "week" ? `w/c ${short(p.date)}` : short(p.date) }));
  const positions = data.map((d) => d.position).filter((p): p is number => p != null);
  const maxPos = positions.length ? Math.max(10, Math.ceil(Math.max(...positions))) : 10;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-muted">Last 90 days of “{query}”</p>
        <Tabs
          variant="pills"
          label="Group by"
          idPrefix={`kh-${query.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`}
          value={granularity}
          onChange={(v) => setGranularity(v as "day" | "week")}
          tabs={[
            { id: "day", label: "Daily" },
            { id: "week", label: "Weekly" },
          ]}
        />
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {!points && !error && <Skeleton className="h-48 w-full" />}
      {points && positions.length === 0 && <Notice tone="neutral">No Search Console data for this keyword in the last 90 days.</Notice>}
      {points && positions.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-1 text-caption uppercase tracking-wider text-muted">Average position (higher on the chart = better)</div>
            <div
              style={{ height: 180 }}
              role="img"
              aria-label={`Average position for ${query}: ${data.filter((d) => d.position != null).map((d) => `${d.label} ${d.position}`).join(", ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="label" {...axis} minTickGap={24} />
                  <YAxis reversed domain={[1, maxPos]} allowDecimals={false} {...axis} width={40} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [v == null ? "not shown" : Number(v).toFixed(1), "Avg position"]} />
                  <Line
                    type="monotone"
                    dataKey="position"
                    name="Avg position"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={data.length <= 16 ? { r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-1)" } : false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div className="mb-1 text-caption uppercase tracking-wider text-muted">Clicks</div>
            <div style={{ height: 180 }} role="img" aria-label={`Clicks for ${query}: ${data.map((d) => `${d.label} ${d.clicks}`).join(", ")}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="label" {...axis} minTickGap={24} />
                  <YAxis allowDecimals={false} {...axis} width={40} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => [Number(v).toLocaleString("en-IN"), "Clicks"]} />
                  <Bar dataKey="clicks" name="Clicks" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      <p className="text-xs text-muted">Days with no line are days Google didn&apos;t show you for this search (or kept the data private).</p>
    </div>
  );
}
