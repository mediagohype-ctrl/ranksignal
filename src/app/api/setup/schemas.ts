// Shared request schemas for the setup endpoints (/api/setup/*).
import { z } from "zod";
import { businessFactsSchema } from "@/lib/setup/facts";

export const websiteSchema = z
  .string()
  .trim()
  .min(3)
  .max(2048)
  .transform((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`))
  .pipe(z.string().url().refine((u) => /^https?:$/.test(new URL(u).protocol), "Use an http or https address"));

export const factsBody = businessFactsSchema;

export const competitorBody = z.object({ name: z.string().trim().min(1).max(120), domain: z.string().trim().max(253).optional() });

/** Setup calls spend AI budget: cap them per user (generous enough for a few retries). */
export const SETUP_RATE = { limit: 40, windowMs: 30 * 60 * 1000 } as const;
