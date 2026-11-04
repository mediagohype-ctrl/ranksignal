// "Email me my full result" after a free check: validation + which lead rows may take an email (pure, unit-tested).
import { z } from "zod";

export const leadEmailSchema = z.object({
  leadId: z
    .string()
    .trim()
    .min(10)
    .max(64)
    .regex(/^[a-z0-9]+$/i, "Invalid check id"),
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address."),
  /** Honeypot: hidden from people, often filled by bots. */
  website: z.string().max(500).optional(),
});
export type LeadEmailInput = z.infer<typeof leadEmailSchema>;

/** A visitor can add their email to a free-check lead for this long after the check ran. */
export const LEAD_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

export type LeadEmailDecision = { ok: true; changed: boolean } | { ok: false; reason: "not_found" | "expired" | "taken" };

/**
 * May this email be stored on this lead? Only free-check leads, only within 24 hours of the check, and an
 * email that is already there is never overwritten by a different one (a lead id cannot be used to hijack it).
 */
export function decideLeadEmail(
  lead: { source: string; email: string | null; createdAt: Date } | null,
  email: string,
  now = Date.now(),
): LeadEmailDecision {
  if (!lead || lead.source !== "free_check") return { ok: false, reason: "not_found" };
  if (now - lead.createdAt.getTime() > LEAD_EMAIL_WINDOW_MS) return { ok: false, reason: "expired" };
  if (lead.email && lead.email !== email) return { ok: false, reason: "taken" };
  return { ok: true, changed: lead.email !== email };
}
