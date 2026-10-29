// GET /api/projects/[id]/search-metrics?from=YYYY-MM-DD&to=YYYY-MM-DD — real Search Console + GA4 numbers stored by
// the daily sync, vs the previous period of the same length. Defaults to the last 28 complete days (UTC).
import { HttpError, handler, json, requireProject, requireSession } from "@/lib/api";
import { getSearchSummary } from "@/lib/google/summary";
import { addDays, ymd } from "@/lib/google/sync";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;
const valid = (d: string) => DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const q = new URL(req.url).searchParams;
  const to = q.get("to") ?? ymd(new Date(Date.now() - 86_400_000));
  const from = q.get("from") ?? (valid(to) ? addDays(to, -27) : "");
  if (!valid(from) || !valid(to)) throw new HttpError(400, "invalid_range", "from and to must be dates like 2026-10-01");
  if (from > to) throw new HttpError(400, "invalid_range", "from must be on or before to");
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 > MAX_DAYS) throw new HttpError(400, "invalid_range", `Choose at most ${MAX_DAYS} days`);
  const item = await getSearchSummary(project.id, s.organizationId, from, to);
  return json({ item });
});
