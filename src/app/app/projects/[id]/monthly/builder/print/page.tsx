// Printable built client report ("Save as PDF"): the template's sections in order, with white-label branding where
// branding.ts allows it. Same print approach as the full report (report/print): opens the print dialog on load.
import { notFound } from "next/navigation";
import { requireAppProject } from "@/lib/dashboard/server";
import { getBranding, toPublicBranding } from "@/lib/branding";
import { loadBuilderReport } from "@/lib/report-builder/data";
import { resolveRange } from "@/lib/report-builder/sections";
import { builtInTemplate, findTemplate } from "@/lib/report-builder/server";
import { BuiltReport } from "@/components/app/report-builder/report-view";
import { BuilderPrintToolbar } from "@/components/app/report-builder/print-toolbar";

export const metadata = { title: "Client report (PDF)", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BuiltReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string | string[]; print?: string | string[] }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, project } = await requireAppProject(id);
  const templateId = typeof sp.template === "string" ? sp.template.slice(0, 64) : null;

  const template = templateId ? await findTemplate(session.organizationId, project.id, templateId) : null;
  if (templateId && !template) notFound();
  const t = template ?? builtInTemplate();

  const [data, branding] = await Promise.all([
    loadBuilderReport({ organizationId: session.organizationId, project, range: resolveRange(t.range) }),
    getBranding(session.organizationId),
  ]);

  return (
    <div className="mx-auto max-w-4xl text-fg print:max-w-none">
      <BuilderPrintToolbar backHref={`/app/projects/${project.id}/monthly/builder`} autoPrint={sp.print !== "0"} />
      <BuiltReport data={data} sections={t.sections} intro={t.intro} notes={t.notes} branding={toPublicBranding(branding)} />
    </div>
  );
}
