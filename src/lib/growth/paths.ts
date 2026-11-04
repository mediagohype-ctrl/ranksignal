// App links used in growth messages, in one place. The To-do tab lives at /app/projects/<id>/todo (brief §5).
import type { SiteReport } from "@/lib/report/types";

export function projectPaths(projectId: string) {
  const base = `/app/projects/${encodeURIComponent(projectId)}`;
  return {
    home: base,
    todo: `${base}/todo`,
    answers: `${base}/visibility`,
    progress: `${base}/reports`,
  };
}

/** "AI named you in X of Y answers" from the stored report; null when AI answers aren't in yet. */
export function aiNamedCounts(r: SiteReport): { named: number; total: number } | null {
  const ai = r.aiVisibility;
  const total = ai.collected ?? ai.sampleSize;
  if (!ai.measured || ai.mentionRate === null || !total) return null;
  return { named: Math.round(ai.mentionRate * total), total };
}
