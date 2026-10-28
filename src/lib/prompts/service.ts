// Prompt-set helpers shared by API routes and jobs.
import type { Project } from "@prisma/client";
import { db } from "@/lib/db";
import type { ResearchProfile } from "./research";

export async function currentPromptSetVersion(organizationId: string, projectId: string): Promise<number> {
  const agg = await db.trackedPrompt.aggregate({ where: { organizationId, projectId }, _max: { promptSetVersion: true } });
  return agg._max.promptSetVersion ?? 1;
}

/** Bump the prompt-set version for all of a project's prompts (a measurement discontinuity). */
export async function bumpPromptSetVersion(organizationId: string, projectId: string): Promise<number> {
  const next = (await currentPromptSetVersion(organizationId, projectId)) + 1;
  await db.trackedPrompt.updateMany({ where: { organizationId, projectId }, data: { promptSetVersion: next } });
  return next;
}

export function researchProfileFromProject(p: Project): ResearchProfile {
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    brandNames: arr(p.brandNames).length ? arr(p.brandNames) : [p.name],
    categories: arr(p.categories),
    audience: p.audience,
    countries: arr(p.countries).length ? arr(p.countries) : ["IN"],
    languages: arr(p.languages).length ? arr(p.languages) : ["en"],
    competitors: ((p.competitors as { name: string }[] | null) ?? []).filter((c) => c && typeof c.name === "string"),
    keywords: arr(p.keywords),
  };
}

export function defaultLocale(p: Project): string {
  const r = researchProfileFromProject(p);
  return `${r.languages[0]}-${r.countries[0]}`;
}
