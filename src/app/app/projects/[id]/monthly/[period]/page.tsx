import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireAppProject } from "@/lib/dashboard/server";
import { getProjectReport, payloadOf } from "@/lib/monthly-report/server";
import { isValidPeriod, periodLabel } from "@/lib/monthly-report/period";
import { MonthlyReportView } from "@/components/app/monthly/report-view";
import { PrintButton } from "@/components/app/print-button";
import { LinkButton, Notice, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  return { title: `${periodLabel(period)} impact report` };
}

export default async function MonthlyReportPage({ params }: { params: Promise<{ id: string; period: string }> }) {
  const { id, period } = await params;
  if (!isValidPeriod(period)) notFound();
  const { session, project } = await requireAppProject(id);
  const report = await getProjectReport(session, project.id, period);
  const payload = report ? payloadOf(report) : null;
  if (!report || !payload) notFound();

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <LinkButton href={`/app/projects/${project.id}/monthly`} variant="ghost" size="sm">
          ← All monthly reports
        </LinkButton>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/projects/${project.id}/monthly-reports/${period}?format=markdown`} download className={buttonClass("secondary")}>
            <Download aria-hidden className="size-4" />
            Download Markdown
          </a>
          <PrintButton label="Download PDF" />
        </div>
      </div>
      {report.status !== "sent" && (
        <Notice tone="warning" title="Draft — not visible to the client" className="no-print mb-6">
          This report is waiting for staff review. Approve and send it from the staff review queue.
        </Notice>
      )}
      <MonthlyReportView payload={payload} summary={report.summary ?? ""} />
    </>
  );
}
