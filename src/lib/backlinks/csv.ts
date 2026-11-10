// CSV exports for the backlink lists (built in the browser from the stored snapshot — no extra paid call).
import type { AnchorRow, Backlink, LinkGapItem, ReferringDomain } from "./parse";

export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "boolean" ? (v ? "yes" : "no") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const referringDomainsCsv = (rows: ReferringDomain[]) =>
  toCsv(
    ["Linking site", "Strength (0-100)", "Links to you", "Followed links", "First seen"],
    rows.map((r) => [r.domain, r.rank, r.backlinks, r.dofollow, r.firstSeen]),
  );

export const backlinksCsv = (rows: Backlink[]) =>
  toCsv(
    ["From page", "From site", "Site strength (0-100)", "Link words", "To page", "Followed", "First seen", "Last seen"],
    rows.map((r) => [r.urlFrom, r.domainFrom, r.domainRank, r.anchor, r.urlTo, r.dofollow, r.firstSeen, r.lastSeen]),
  );

export const anchorsCsv = (rows: AnchorRow[]) =>
  toCsv(
    ["Link words", "Links", "Linking sites", "First seen"],
    rows.map((r) => [r.anchor ?? "(no words, e.g. an image)", r.backlinks, r.referringDomains, r.firstSeen]),
  );

export const linkGapCsv = (rows: LinkGapItem[]) =>
  toCsv(
    ["Site", "Strength (0-100)", "Links to competitors", "Competitors it links to"],
    rows.map((r) => [r.domain, r.rank, r.backlinks, r.linksTo.join(" | ")]),
  );
