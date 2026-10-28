// Validation for project settings shared by POST /api/projects and PATCH /api/projects/[id].
import { z } from "zod";
import { projectInputSchema } from "@/lib/types";

export const projectSettingsSchema = z
  .object({
    maxPagesPerCrawl: z.number().int().min(1).max(10_000).optional(),
    automation: z.object({ allowClassB: z.array(z.string().min(1).max(64)).max(50).default([]) }).optional(),
  })
  .passthrough();

export type ProjectSettingsInput = z.infer<typeof projectSettingsSchema>;

export const projectCreateSchema = projectInputSchema.extend({ settings: projectSettingsSchema.optional() });

// PATCH: every field optional, no defaults injected (so omitted fields are left untouched).
export const projectPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  websiteUrl: z.string().url().optional(),
  brandNames: z.array(z.string().min(1)).min(1).max(20).optional(),
  categories: z.array(z.string()).max(20).optional(),
  audience: z.string().max(500).nullable().optional(),
  countries: z.array(z.string().length(2)).max(20).optional(),
  languages: z.array(z.string().min(2).max(5)).max(10).optional(),
  competitors: z
    .array(z.object({ name: z.string().min(1), domain: z.string().optional(), aliases: z.array(z.string()).default([]) }))
    .max(20)
    .optional(),
  keywords: z.array(z.string()).max(100).optional(),
  settings: projectSettingsSchema.optional(),
});

export interface ProjectSettings {
  maxPagesPerCrawl?: number;
  automation?: { allowClassB?: string[] };
  [k: string]: unknown;
}

export function readSettings(v: unknown): ProjectSettings {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as ProjectSettings) : {};
}
