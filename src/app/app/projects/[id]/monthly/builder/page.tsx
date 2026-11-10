// Report builder: agencies choose the sections, order, intro note, agency notes and dates of a client report,
// save it as a template (per website, or the organization default) and get a PDF or a share link.
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { getBranding } from "@/lib/branding";
import { readShareSettings, shareUrl, signShareToken } from "@/lib/share/token";
import { builtInTemplate, listTemplates } from "@/lib/report-builder/server";
import { ReportBuilder } from "@/components/app/report-builder/builder";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Report builder" };
export const dynamic = "force-dynamic";

export default async function ReportBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const [{ items, orgDefault, limits }, branding] = await Promise.all([listTemplates(session.organizationId, project.id), getBranding(session.organizationId)]);
  const isAdmin = hasRole(session, "admin") && !session.readOnly;
  const canEdit = hasRole(session, "member") && !session.readOnly;

  // Share links reuse the website's report sharing (src/lib/share): only admins get the URL, as on the share API.
  let shareBase: string | null = null;
  const share = readShareSettings(project.settings);
  if (isAdmin && share?.enabled) {
    try {
      shareBase = shareUrl(await signShareToken({ projectId: project.id, tokenId: share.tokenId }));
    } catch {
      shareBase = null; // SESSION_SECRET missing in this environment
    }
  }
  const starter = orgDefault ? { ...orgDefault, name: `${project.name} report`, shareEnabled: false } : builtInTemplate();

  return (
    <>
      <PageHeader
        eyebrow="Progress"
        title="Report builder"
        description={`Build a client report for ${project.name}: pick the sections and their order, add your own notes, choose the dates, then save it as a PDF or share a link.`}
      />
      <ReportBuilder
        projectId={project.id}
        templates={items}
        orgDefault={orgDefault}
        starter={starter}
        limits={limits}
        canEdit={canEdit}
        isAdmin={isAdmin}
        shareBase={shareBase}
        whiteLabel={branding.custom}
      />
    </>
  );
}
