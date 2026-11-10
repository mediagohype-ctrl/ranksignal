// CSV export for the Keywords table. Cells that a spreadsheet would treat as a formula are neutralised.
import type { KeywordStat } from "./analyze";

export function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Formula injection guard (=, +, -, @, tab, CR at the start) — searches are user-generated text. Numbers pass as-is.
  const numeric = typeof v === "number" || /^-?\d+(\.\d+)?$/.test(s);
  if (!numeric && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const num = (n: number | null | undefined, digits?: number) => (n == null ? "" : digits == null ? String(n) : n.toFixed(digits));

export function keywordsCsv(stats: KeywordStat[], range: { from: string; to: string }): string {
  const header = [
    "Keyword", "Clicks", "Impressions", "CTR %", "Avg position",
    "Previous clicks", "Previous impressions", "Previous avg position", "Clicks change", "Position change (+ = worse)", "From", "To",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const k of stats) {
    lines.push(
      [
        k.query,
        k.clicks,
        k.impressions,
        num(k.ctr == null ? null : k.ctr * 100, 2),
        num(k.position, 1),
        num(k.previous?.clicks),
        num(k.previous?.impressions),
        num(k.previous?.position, 1),
        k.clicksChange,
        num(k.positionChange, 1),
        range.from,
        range.to,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
