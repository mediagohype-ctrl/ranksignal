import type { Project } from "@prisma/client";
import { normalizeDomain, type EntityRef } from "./parse";
import { brandNameVariants } from "@/lib/setup/brand-names";

export interface ProjectVisibilityContext {
  brandNames: string[];
  competitors: (EntityRef & { aliases: string[] })[];
  websiteUrl: string;
  websiteDomain: string;
}

export function projectVisibilityContext(project: Pick<Project, "brandNames" | "competitors" | "websiteUrl" | "name">): ProjectVisibilityContext {
  const brandNames = ((project.brandNames as string[] | null) ?? []).filter((s) => typeof s === "string" && s.trim());
  const competitors = ((project.competitors as { name: string; domain?: string; aliases?: string[] }[] | null) ?? [])
    .filter((c) => c && typeof c.name === "string" && c.name.trim())
    .map((c) => ({ name: c.name, domain: c.domain || undefined, aliases: Array.isArray(c.aliases) ? c.aliases : [] }));
  return {
    // Every name people use, in every spacing ("Go Hype Media" → also "GoHype Media", "GoHypeMedia"); the main name stays first.
    brandNames: brandNameVariants(brandNames.length ? brandNames : [project.name]),
    competitors,
    websiteUrl: project.websiteUrl,
    websiteDomain: normalizeDomain(project.websiteUrl),
  };
}
