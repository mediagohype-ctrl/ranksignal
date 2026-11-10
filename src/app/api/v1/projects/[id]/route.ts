// GET /api/v1/projects/{id} — one project of the API key's organization (404 for any other).
import { apiRoute } from "@/lib/public-api/http";
import { getProject } from "@/lib/public-api/service";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(async (_req, { principal }, { id }) => ({ data: await getProject(principal.organizationId, id) }));
