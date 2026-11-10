// GET /api/v1/projects/{id}/scores?from=&to=&kind=&cursor=&limit= — score history (real data only), newest first.
import { HttpError } from "@/lib/api";
import { apiRoute } from "@/lib/public-api/http";
import { decodeKeysetCursor, parseEnum, parseLimit } from "@/lib/public-api/params";
import { listScores } from "@/lib/public-api/service";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function day(raw: string | null, name: string, plusOne = false): Date | undefined {
  if (raw === null || raw === "") return undefined;
  const t = DATE_RE.test(raw) ? Date.parse(`${raw}T00:00:00Z`) : NaN;
  if (Number.isNaN(t)) throw new HttpError(400, "invalid_request", `${name} must be a date like 2026-10-01`);
  return new Date(plusOne ? t + 86_400_000 : t);
}

export const GET = apiRoute<{ id: string }>(async (_req, { principal, url }, { id }) => {
  const q = url.searchParams;
  const from = day(q.get("from"), "from");
  const to = day(q.get("to"), "to", true); // inclusive day → exclusive bound
  if (from && to && from >= to) throw new HttpError(400, "invalid_request", "from must be on or before to");
  const page = await listScores(principal.organizationId, id, {
    from,
    to,
    kind: parseEnum(q.get("kind"), ["crawl", "visibility"] as const, "kind"),
    cursor: decodeKeysetCursor(q.get("cursor")),
    limit: parseLimit(q.get("limit"), 100, 500),
  });
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
});
