// POST /api/integrations/google/disconnect {projectId, product} — revokes the token at Google, wipes the stored
// credential and removes the connection. Previously synced daily metrics are kept as history. Admin+. Audit-logged.
import { z } from "zod";
import { HttpError, handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { disconnectGoogleIntegration, findGoogleIntegration, googleIntegrationView } from "@/lib/google/integration";
import { productSchema, projectIdSchema } from "@/lib/google/route-helpers";

const schema = z.object({ projectId: projectIdSchema, product: productSchema });

export const POST = handler(async (req: Request) => {
  const s = await requireSession("admin");
  const body = await parseBody(req, schema);
  const project = await requireProject(s, body.projectId);
  const row = await findGoogleIntegration(s.organizationId, project.id, body.product);
  if (!row) throw new HttpError(404, "not_found", "No Google connection to remove.");
  const { revoked } = await disconnectGoogleIntegration(row, { userId: s.userId, actorType: s.staffMode ? "staff" : "user" });
  return json({ item: { ...googleIntegrationView(body.product, null), revoked } });
});
