// Copy helpers for the page-by-page table (client-safe, pure).
import type { ChangeRow } from "./types";

/** Problems whose "Change it to" column is ready text to paste (not an instruction). */
export const COPYABLE_CHANGES = new Set(["seo-titles", "seo-meta_description", "brand-name_consistency"]);

const cell = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();

/** Tab-separated rows with a header line: pastes into Excel / Google Sheets as a table. */
export function changesAsTable(rows: ChangeRow[]): string {
  return [["Page", "Now", "Change it to"], ...rows.map((r) => [r.page, r.now, r.change])].map((r) => r.map(cell).join("\t")).join("\n");
}
