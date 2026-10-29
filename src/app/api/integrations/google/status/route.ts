// GET /api/integrations/google/status?projectId=… — whether Google is configured on this server and the project's
// GSC / GA4 connection state. Never returns credentials.
import { HttpError, handler, json, requireProject, requireSession } from "@/lib/api";
import { GOOGLE_PRODUCTS, NOT_CONFIGURED_MESSAGE, googleRedirectUri, isGoogleConfigured } from "@/lib/google/config";
import { findGoogleIntegration, googleIntegrationView } from "@/lib/google/integration";
import { projectIdSchema } from "@/lib/google/route-helpers";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const pid = projectIdSchema.safeParse(new URL(req.url).searchParams.get("projectId"));
  if (!pid.success) throw new HttpError(400, "invalid_request", "projectId is required");
  const project = await requireProject(s, pid.data);
  const items = await Promise.all(
    GOOGLE_PRODUCTS.map(async (p) => googleIntegrationView(p, await findGoogleIntegration(s.organizationId, project.id, p))),
  );
  const configured = isGoogleConfigured();
  return json({
    configured,
    message: configured ? null : NOT_CONFIGURED_MESSAGE,
    redirectUri: googleRedirectUri(),
    items,
  });
});
