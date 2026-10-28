"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const axis = { stroke: "var(--chart-grid)", tick: { fill: "var(--muted)", fontSize: 12 }, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--fg)",
  },
  labelStyle: { color: "var(--muted)" },
  cursor: { stroke: "var(--chart-grid)" },
};

export interface TrendPoint {
  label: string;
  value: number;
  discontinuity?: boolean;
  promptSetVersion?: number;
}

/** Single-series trend line; dashed markers where the prompt set changed (measurement discontinuity). */
export function TrendChart({
  data,
  name,
  domain = [0, 100],
  format = (v: number) => String(Math.round(v)),
  height = 220,
}: {
  data: TrendPoint[];
  name: string;
  domain?: [number, number];
  format?: (v: number) => string;
  height?: number;
}) {
  return (
    <div style={{ height }} role="img" aria-label={`${name} trend: ${data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis domain={domain} {...axis} tickFormatter={format} width={44} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v) => [format(Number(v)), name]}
            labelFormatter={(l, payload) => {
              const p = payload?.[0]?.payload as TrendPoint | undefined;
              return p?.promptSetVersion ? `${l} · prompt set v${p.promptSetVersion}` : String(l);
            }}
          />
          {data
            .filter((d) => d.discontinuity)
            .map((d) => (
              <ReferenceLine
                key={`disc-${d.label}`}
                x={d.label}
                stroke="var(--warning)"
                strokeDasharray="4 3"
                label={{ value: `Questions changed (v${d.promptSetVersion})`, position: "top", fill: "var(--warning)", fontSize: 11 }}
              />
            ))}
          <Line
            type="monotone"
            dataKey="value"
            name={name}
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--chart-1)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal share bars; the customer's brand in --chart-2 (teal), competitors in --chart-1. */
export function ShareBarChart({
  data,
  brand,
  label = "Share of mentions",
}: {
  data: { name: string; share: number }[];
  brand: string[];
  label?: string;
}) {
  const lower = brand.map((b) => b.toLowerCase());
  const rows = [...data].sort((a, b) => b.share - a.share).slice(0, 10);
  const height = Math.max(120, rows.length * 34 + 20);
  return (
    <div style={{ height }} role="img" aria-label={`${label}: ${rows.map((r) => `${r.name} ${Math.round(r.share * 100)}%`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 4 }} barCategoryGap={8}>
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis type="number" domain={[0, 1]} {...axis} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
          <YAxis type="category" dataKey="name" {...axis} width={120} tick={{ fill: "var(--fg)", fontSize: 12 }} />
          <Tooltip
            {...tooltipStyle}
            cursor={{ fill: "var(--surface-2)" }}
            formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, label]}
          />
          <Bar
            dataKey="share"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: "right", fill: "var(--muted)", fontSize: 11, formatter: (v: unknown) => `${Math.round(Number(v) * 100)}%` }}
          >
            {rows.map((r) => (
              <Cell key={r.name} fill={lower.includes(r.name.toLowerCase()) ? "var(--chart-2)" : "var(--chart-1)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Score history (overall + 4 pillars) on a time axis, with method/prompt-set markers and shipped-change dots.

export interface ScoreHistoryPoint {
  t: number; // epoch ms
  overall: number | null;
  seo: number | null;
  aeo: number | null;
  geo: number | null;
  brand: number | null;
}
export interface HistoryMarker {
  t: number;
  kind: "methodology" | "prompt_set";
  label: string;
}
export interface ShippedMarker {
  t: number;
  count: number;
  label: string;
}

const SCORE_SERIES: { key: keyof Omit<ScoreHistoryPoint, "t">; name: string; color: string; width: number }[] = [
  { key: "overall", name: "Overall", color: "var(--chart-1)", width: 3 },
  { key: "seo", name: "SEO", color: "var(--chart-2)", width: 2 },
  { key: "aeo", name: "AEO", color: "var(--chart-3)", width: 2 },
  { key: "geo", name: "GEO", color: "var(--chart-4)", width: 2 },
  { key: "brand", name: "Brand", color: "var(--chart-5)", width: 2 },
];

const shortDate = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const longDate = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function ScoreHistoryChart({
  data,
  markers = [],
  shipped = [],
  height = 300,
}: {
  data: ScoreHistoryPoint[];
  markers?: HistoryMarker[];
  shipped?: ShippedMarker[];
  height?: number;
}) {
  const times = [...data.map((d) => d.t), ...shipped.map((s) => s.t)];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const pad = Math.max(86_400_000, (max - min) * 0.03);
  const last = data[data.length - 1];
  const summary = last
    ? `Score history, ${data.length} measurements. Latest ${longDate(last.t)}: ${SCORE_SERIES.map((s) => `${s.name} ${last[s.key] ?? "not measured"}`).join(", ")}.`
    : "Score history: no measurements.";
  return (
    <div style={{ height }} role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[min - pad, max + pad]}
            tickFormatter={shortDate}
            {...axis}
            minTickGap={32}
          />
          <YAxis domain={[0, 100]} {...axis} width={44} />
          <Tooltip
            {...tooltipStyle}
            labelFormatter={(l) => longDate(Number(l))}
            formatter={(v, n) => [v === null || v === undefined ? "—" : String(Math.round(Number(v))), String(n)]}
          />
          <Legend verticalAlign="bottom" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--fg-soft)" }} />
          {markers.map((m, i) => (
            <ReferenceLine
              key={`m-${m.t}-${i}`}
              x={m.t}
              stroke={m.kind === "methodology" ? "var(--muted)" : "var(--warning)"}
              strokeDasharray="4 3"
              label={{ value: m.label, position: "insideTopLeft", fill: "var(--muted)", fontSize: 11 }}
            />
          ))}
          {SCORE_SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={s.width}
              connectNulls
              dot={{ r: s.key === "overall" ? 4 : 3, strokeWidth: 2, stroke: "var(--surface)", fill: s.color }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
          {shipped.map((s) => (
            <ReferenceDot
              key={`s-${s.t}`}
              x={s.t}
              y={3}
              r={Math.min(9, 4 + s.count)}
              fill="var(--fg-soft)"
              stroke="var(--surface)"
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
