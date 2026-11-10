// GET /api/v1/projects/{id}/report — latest stored SiteReport (never triggers a new check or a paid AI call).
import { apiRoute } from "@/lib/public-api/http";
import { getReport } from "@/lib/public-api/service";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(async (_req, { principal }, { id }) => ({ data: await getReport(principal.organizationId, id) }));
