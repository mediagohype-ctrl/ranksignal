// Public view of a built client report, reusing the website's report sharing (src/lib/share): the URL carries the
// project's signed share token, and the report is shown only while (1) sharing is on for the website with that
// token id, and (2) this template belongs to that website and has sharing switched on. Internal details are
// stripped exactly as on the shared full report.
import { db } from "@/lib/db";
import { getBranding, toPublicBranding, type PublicBranding } from "@/lib/branding";
import { isShareActive, verifyShareToken } from "@/lib/share/token";
import { loadBuilderReport, type BuilderReportData } from "./data";
import { resolveRange, toTemplateView, type TemplateView } from "./sections";

export type SharedBuiltReport =
  | { status: "ok"; data: BuilderReportData; template: TemplateView; branding: PublicBranding }
  | { status: "not_found" };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function loadSharedBuiltReport(token: string, templateId: string, now = new Date()): Promise<SharedBuiltReport> {
  if (!ID_RE.test(templateId)) return { status: "not_found" };
  const claims = await verifyShareToken(token);
  if (!claims) return { status: "not_found" };
  const project = await db.project.findUnique({
    where: { id: claims.projectId },
    select: { id: true, organizationId: true, name: true, websiteUrl: true, settings: true },
  });
  if (!project || !isShareActive(project.settings, claims)) return { status: "not_found" };
  const row = await db.reportTemplate.findFirst({
    where: { id: templateId, organizationId: project.organizationId, projectId: project.id, shareEnabled: true },
  });
  if (!row) return { status: "not_found" };
  const template = toTemplateView(row);
  const [data, branding] = await Promise.all([
    loadBuilderReport({
      organizationId: project.organizationId,
      project: { id: project.id, name: project.name, websiteUrl: project.websiteUrl },
      range: resolveRange(template.range, now),
      publicView: true,
      now,
    }),
    getBranding(project.organizationId),
  ]);
  return { status: "ok", data, template, branding: toPublicBranding(branding) };
}
