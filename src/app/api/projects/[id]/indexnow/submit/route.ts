// POST { urls: string[] } — send specific pages to IndexNow now (members). Only URLs on the verified site are queued.
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { queueIndexNowUrls } from "@/lib/indexnow-customer/service";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ urls: z.array(z.string().trim().min(1).max(2048)).min(1).max(100) });

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const { urls } = await parseBody(req, bodySchema);
  const site = await db.indexNowSite.findFirst({ where: { organizationId: s.organizationId, projectId: project.id } });
  if (!site?.enabled) throw new HttpError(409, "not_verified", "Verify your IndexNow key file first.");
  const queued = await queueIndexNowUrls({ organizationId: s.organizationId, projectId: project.id, urls, trigger: "manual" });
  if (queued === 0) throw new HttpError(400, "no_valid_urls", `None of these addresses are on ${site.host}. Use full addresses like https://${site.host}/page.`);
  return json({ item: { queued } });
});
