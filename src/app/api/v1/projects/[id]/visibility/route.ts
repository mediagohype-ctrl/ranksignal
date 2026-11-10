// GET /api/v1/projects/{id}/visibility — latest finished AI check: summary rates + per-question, per-assistant results.
import { apiRoute } from "@/lib/public-api/http";
import { getVisibility } from "@/lib/public-api/service";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(async (_req, { principal }, { id }) => ({ data: await getVisibility(principal.organizationId, id) }));
