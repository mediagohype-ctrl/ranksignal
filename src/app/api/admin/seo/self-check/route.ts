// POST /api/admin/seo/self-check {url?} — run the free SEO/AEO/GEO check against our own site (or any page of it).
// Not stored as a lead. seo.view is enough: it only reads public pages.
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { requireStaffApi } from "@/lib/admin/guard";
import { runFreeCheck } from "@/lib/free-check/run";
import { siteBase } from "@/lib/free-check/site-seo";

const schema = z.object({ url: z.string().url().max(2048).optional() });

export const POST = handler(async (req: Request) => {
  await requireStaffApi("seo.view");
  const { url } = await parseBody(req, schema);
  const base = siteBase();
  const target = url ?? `${base}/`;
  if (/localhost|127\.0\.0\.1/.test(target)) {
    throw new HttpError(400, "not_public", "Self-check needs the public site. Set APP_URL to the live https address, or paste a live URL.");
  }
  const result = await runFreeCheck(target);
  return json({
    item: {
      url: result.url,
      checkedAt: result.checkedAt,
      overall: result.overall,
      pillars: result.pillars.map((p) => ({ pillar: p.pillar, label: p.label, score: p.score, grade: p.grade, summary: p.summary })),
      issues: result.issues.map((i) => ({ id: i.id, pillarLabel: i.pillarLabel, title: i.title, whatsWrong: i.whatsWrong, howToFix: i.howToFix })),
      totalIssues: result.totalIssues,
      strengths: result.strengths,
    },
  });
});
