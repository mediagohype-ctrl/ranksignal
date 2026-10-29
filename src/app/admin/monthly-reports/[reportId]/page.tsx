// Staff review of one monthly report: edit wording, preview, approve & send or regenerate.
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/auth/staff";
import { periodLabel } from "@/lib/monthly-report/period";
import { payloadOf } from "@/lib/monthly-report/server";
import { MonthlyReportView } from "@/components/app/monthly/report-view";
import { ReviewEditor } from "@/components/app/monthly/review-editor";
import { Badge, EmptyState, Notice, PageHeader } from "@/components/ui";
import { getBranding, toPublicBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review monthly report" };

export default async function ReviewMonthlyReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  if (!(await getStaffUser())) notFound();
  const { reportId } = await params;
  const report = await db.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report) notFound();
  const [project, org, reviewer] = await Promise.all([
    db.project.findUnique({ where: { id: report.projectId }, select: { name: true } }),
    db.organization.findUnique({ where: { id: report.organizationId }, select: { name: true, serviceTier: true } }),
    report.reviewedById ? db.user.findUnique({ where: { id: report.reviewedById }, select: { email: true } }) : Promise.resolve(null),
  ]);
  const payload = payloadOf(report);
  const sent = report.status === "sent";

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Monthly reports", href: "/admin/monthly-reports" },
          { label: `${project?.name ?? "Project"} · ${periodLabel(report.period)}` },
        ]}
        eyebrow={org?.name ?? "Organization"}
        title={`${periodLabel(report.period)} · ${project?.name ?? "Deleted project"}`}
        meta={
          <>
            <Badge tone={sent ? "success" : "warning"} variant="dot" className="capitalize">
              {report.status}
            </Badge>
            {org?.serviceTier ? (
              <Badge tone="primary" className="capitalize">
                {org.serviceTier}
              </Badge>
            ) : (
              <Badge tone="neutral">Self-serve</Badge>
            )}
            {payload && <span>Summary: {payload.dataSources.summarySource === "llm" ? "AI-drafted" : "template"}</span>}
          </>
        }
        className="mb-0"
      />
      {sent && (
        <Notice tone="success" title="Sent">
          Sent {report.sentAt?.toISOString().slice(0, 16).replace("T", " ")} UTC
          {reviewer ? ` · approved by ${reviewer.email}` : " · sent automatically"}. Sent reports can&apos;t be edited.
        </Notice>
      )}
      {!payload ? (
        <EmptyState bordered title="This report has no content" description="Generate it again from the queue to build the numbers." />
      ) : (
        <>
          <ReviewEditor
            reportId={report.id}
            initialSummary={report.summary ?? ""}
            initialHeadline={payload.headline}
            sent={sent}
            clientLabel={org?.name ?? "the client"}
          />
          <section aria-labelledby="preview-heading" className="space-y-3">
            <h2 id="preview-heading" className="text-h3 text-fg">
              Preview (what the client sees)
            </h2>
            <div className="rounded-2xl border border-dashed border-border-strong p-3 sm:p-5">
              <MonthlyReportView payload={payload} summary={report.summary ?? ""} branding={toPublicBranding(await getBranding(report.organizationId))} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
