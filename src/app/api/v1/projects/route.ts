// GET /api/v1/projects?cursor=&limit= — projects in the API key's organization, newest first.
import { apiRoute } from "@/lib/public-api/http";
import { decodeKeysetCursor, parseLimit } from "@/lib/public-api/params";
import { listProjects } from "@/lib/public-api/service";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async (_req, { principal, url }) => {
  const q = url.searchParams;
  const page = await listProjects(principal.organizationId, { cursor: decodeKeysetCursor(q.get("cursor")), limit: parseLimit(q.get("limit"), 50, 100) });
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
});
