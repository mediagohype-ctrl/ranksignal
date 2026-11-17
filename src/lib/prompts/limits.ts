// How many customer questions one AI check asks, and which ones (pure, client-safe).
// The AI check (src/lib/visibility/job.ts) asks the switched-on questions ordered by priority (Important first),
// then oldest first, and stops at the plan's questions-per-check number. Anything beyond that is NOT asked until
// a place is free — so the screen must say so instead of silently counting 26 while asking 25.

export interface QuestionLite {
  id: string;
  active: boolean;
  priority: number;
  /** ISO date or Date; older questions are asked first within the same priority. */
  createdAt?: string | Date | null;
}

const time = (v: QuestionLite["createdAt"]) => (v ? new Date(v).getTime() || 0 : 0);

/** Ids of the questions the next AI check will ask, in the order the check picks them. */
export function questionsAskedNext(questions: QuestionLite[], perCheck: number): string[] {
  return questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => q.active)
    .sort((a, b) => a.q.priority - b.q.priority || time(a.q.createdAt) - time(b.q.createdAt) || a.i - b.i)
    .slice(0, Math.max(0, perCheck))
    .map(({ q }) => q.id);
}

/**
 * The warning shown when more questions are switched on than one AI check asks. Null when everything is asked.
 * e.g. "You have 26 questions switched on; each AI check asks 25. Pause one or mark your most important ones —
 * the rest wait until a place is free."
 */
export function questionCapWarning(activeCount: number, perCheck: number): string | null {
  if (!(perCheck > 0) || activeCount <= perCheck) return null;
  const extra = activeCount - perCheck;
  return `You have ${activeCount} questions switched on; each AI check asks ${perCheck}. Pause ${extra === 1 ? "one" : extra} or mark your most important ones — the rest wait until a place is free.`;
}

/** One line on how the check picks its questions. */
export const QUESTION_ORDER_LINE = "Each AI check asks the questions you marked Important first, then your oldest questions.";

/** Priority values stored on a question: 1 = Important (asked first), 2 = Normal, 3 = Low. */
export const PRIORITY_IMPORTANT = 1;
export const PRIORITY_NORMAL = 2;
