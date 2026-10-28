"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
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
