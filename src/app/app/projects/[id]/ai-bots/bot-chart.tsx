"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const axis = { stroke: "var(--chart-grid)", tick: { fill: "var(--muted)", fontSize: 12 }, tickLine: false, axisLine: false } as const;

/** Stacked daily visits for the top AI crawlers (everything else grouped as "Other AI crawlers"). */
export function BotVisitsChart({ data, bots }: { data: Record<string, string | number>[]; bots: string[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label={`Daily visits by ${bots.join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={16} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" }}
            labelStyle={{ color: "var(--muted)" }}
            cursor={{ fill: "var(--chart-grid)", opacity: 0.4 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bots.map((b, i) => (
            <Bar key={b} dataKey={b} stackId="v" fill={i < COLORS.length ? COLORS[i] : "var(--chart-muted)"} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
