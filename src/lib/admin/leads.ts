// Lead capture for the admin CRM. Best-effort: never throws, never blocks the public response.
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export const LEAD_SOURCES = ["free_check", "contact", "signup_intent"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Pseudonymous IP fingerprint: first 32 hex chars of sha256(ip + SESSION_SECRET). The raw IP is never stored. */
export function hashIp(ip: string | null | undefined, secret = process.env.SESSION_SECRET ?? ""): string | null {
  if (!ip || ip === "unknown") return null;
  return createHash("sha256").update(`${ip}${secret}`).digest("hex").slice(0, 32);
}

export interface LeadInput {
  source: LeadSource;
  email?: string | null;
  name?: string | null;
  company?: string | null;
  url?: string | null;
  message?: string | null;
  score?: number | null;
  /** Raw client IP — hashed here, never stored. */
  ip?: string | null;
}

const clip = (s: string | null | undefined, max: number) => (s ? s.slice(0, max) : null);

/** The exact row written for a lead (exported for tests). */
export function leadRowData(input: LeadInput) {
  return {
    source: input.source,
    email: clip(input.email?.trim().toLowerCase(), 254),
    name: clip(input.name?.trim(), 100),
    company: clip(input.company?.trim() || null, 120),
    url: clip(input.url, 2048),
    message: clip(input.message, 5000),
    score: typeof input.score === "number" && Number.isFinite(input.score) ? Math.round(input.score) : null,
    ipHash: hashIp(input.ip),
  };
}

/** Insert a Lead row. Resolves to the id, or null on any failure (logged without personal data). */
export async function recordLead(input: LeadInput): Promise<string | null> {
  try {
    const row = await db.lead.create({ data: leadRowData(input), select: { id: true } });
    return row.id;
  } catch (e) {
    console.warn("[leads] could not record lead", (e as Error)?.name ?? "error");
    return null;
  }
}

/** Fire-and-forget wrapper for public routes: the response never waits for (or fails on) the insert. */
export function recordLeadInBackground(input: LeadInput): void {
  try {
    void recordLead(input);
  } catch {
    /* never block the caller */
  }
}

export const LEAD_CSV_FIELDS = ["id", "createdAt", "source", "status", "name", "email", "company", "url", "score", "message", "notes"] as const;

function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function leadsToCsv(rows: Partial<Record<(typeof LEAD_CSV_FIELDS)[number], unknown>>[]): string {
  const lines = [LEAD_CSV_FIELDS.join(",")];
  for (const r of rows) lines.push(LEAD_CSV_FIELDS.map((f) => csvCell(r[f])).join(","));
  return lines.join("\r\n") + "\r\n";
}
