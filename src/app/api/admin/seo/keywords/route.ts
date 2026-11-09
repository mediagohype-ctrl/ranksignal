// /api/admin/seo/keywords — GET list (seo.view); POST add one keyword, or {starter: true} to add the starter list (seo.manage).
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { staffAudit } from "@/lib/admin/audit";
import { keywordInputSchema, STARTER_KEYWORDS } from "@/lib/seo/keywords";

export const GET = handler(async () => {
  await requireStaffApi("seo.view");
  return json({ items: await db.seoKeyword.findMany({ orderBy: [{ priority: "asc" }, { phrase: "asc" }] }) });
});


export const POST = handler(async (req: Request) => {
  const staff = await requireStaffApi("seo.manage");
  // Parse with the matching schema (a z.union would hide which keyword field was wrong).
  const raw = await parseBody(req, z.record(z.unknown()));
  if (raw.starter === true) {
    const rows = STARTER_KEYWORDS.map((k) => keywordInputSchema.parse(k));
    const r = await db.seoKeyword.createMany({ data: rows, skipDuplicates: true });
    await staffAudit(staff, req, { action: "seo.keywords_seeded", resourceType: "seo_keyword", resourceId: "starter", after: { added: r.count } });
    return json({ item: { added: r.count } });
  }
  const body = keywordInputSchema.parse(raw);
  try {
    const item = await db.seoKeyword.create({ data: { ...body, checkedAt: body.googlePosition != null || body.aiMentioned != null ? new Date() : null } });
    await staffAudit(staff, req, { action: "seo.keyword_added", resourceType: "seo_keyword", resourceId: item.id, after: { phrase: item.phrase } });
    return json({ item });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, "duplicate", "This phrase is already tracked.");
    throw e;
  }
});
