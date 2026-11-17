// Competitor suggestions from the AI answers themselves (free: no paid data call). When a project has no
// competitors saved, "You vs competitors" can only show the business on its own — so we suggest the businesses AI
// already names or links for this project's questions, with one-click "Add". Tenant-scoped.
import { db } from "@/lib/db";
import { loadAnswerEvidence, suggestionContext } from "@/lib/offsite/evidence";
import { splitCitations, type CompetitorSiteSuggestion } from "@/lib/offsite/suggestions";

export const MAX_AI_COMPETITOR_SUGGESTIONS = 5;

export interface AiCompetitorSuggestions {
  items: CompetitorSiteSuggestion[];
  /** How many competitors the project already has saved. */
  saved: number;
  /** When the AI check these come from finished; null when there is no real AI check yet. */
  measuredAt: string | null;
}

export async function getAiCompetitorSuggestions(organizationId: string, projectId: string): Promise<AiCompetitorSuggestions | null> {
  const project = await db.project.findFirst({
    where: { id: projectId, organizationId },
    select: { websiteUrl: true, competitors: true, categories: true, keywords: true },
  });
  if (!project) return null;
  const evidence = await loadAnswerEvidence(organizationId, projectId);
  const { competitors } = splitCitations(evidence.sources, suggestionContext(project, evidence));
  return {
    items: competitors.slice(0, MAX_AI_COMPETITOR_SUGGESTIONS),
    saved: Array.isArray(project.competitors) ? project.competitors.length : 0,
    measuredAt: evidence.measuredAt,
  };
}
