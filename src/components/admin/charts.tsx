"use client";
// Admin charts (recharts) using the design-system chart tokens.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-muted)"];
const axis = { stroke: "var(--chart-grid)", tick: { fill: "var(--muted)", fontSize: 11 }, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" },
  labelStyle: { color: "var(--muted)" },
};

export type ChartRow = { day: string } & Record<string, number | string>;
type Fmt = "count" | "usd";

function formatter(fmt: Fmt) {
  return (v: number) => (fmt === "usd" ? `$${v.toFixed(v >= 10 ? 0 : 2)}` : Math.round(v).toLocaleString());
}

function summary(data: ChartRow[], keys: string[], fmt: Fmt) {
  const f = formatter(fmt);
  return keys.map((k) => `${k}: ${f(data.reduce((a, r) => a + Number(r[k] ?? 0), 0))} total`).join(", ");
}

/** Stacked daily bars (e.g. AI cost per provider per day). */
export function DailyStackedBars({ data, keys, title, format = "count", height = 240 }: { data: ChartRow[]; keys: string[]; title: string; format?: Fmt; height?: number }) {
  const f = formatter(format);
  if (!keys.length) return <EmptyChart height={height} />;
  return (
    <div style={{ height }} role="img" aria-label={`${title}. ${summary(data, keys, format)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="day" {...axis} minTickGap={16} />
          <YAxis {...axis} tickFormatter={f} width={48} allowDecimals={format === "usd"} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--surface-2)" }} formatter={(v, n) => [f(Number(v)), String(n)]} />
          {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} iconType="circle" iconSize={8} />}
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === keys.length - 1 ? [3, 3, 0, 0] : 0} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Daily area/line series (e.g. signups, scans). */
export function DailyArea({ data, keys, title, format = "count", height = 240 }: { data: ChartRow[]; keys: string[]; title: string; format?: Fmt; height?: number }) {
  const f = formatter(format);
  return (
    <div style={{ height }} role="img" aria-label={`${title}. ${summary(data, keys, format)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="day" {...axis} minTickGap={16} />
          <YAxis {...axis} tickFormatter={f} width={48} allowDecimals={false} />
          <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--chart-grid)" }} formatter={(v, n) => [f(Number(v)), String(n)]} />
          {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} iconType="circle" iconSize={8} />}
          {keys.map((k, i) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.12}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center rounded-xl border border-dashed border-border text-small text-muted">
      No data in this period
    </div>
  );
}
