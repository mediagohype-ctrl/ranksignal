import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireAppProject } from "@/lib/dashboard/server";
import { getProjectReport, payloadOf } from "@/lib/monthly-report/server";
import { isValidPeriod, periodLabel } from "@/lib/monthly-report/period";
import { MonthlyReportView } from "@/components/app/monthly/report-view";
import { PrintButton } from "@/components/app/print-button";
import { LinkButton, Notice, buttonClass } from "@/components/ui";
import { getBranding, toPublicBranding } from "@/lib/branding";
import { bookCallHref } from "@/lib/brand";
import { monthlyNudge } from "@/lib/monthly-report/email";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  return { title: `${periodLabel(period)} monthly report` };
}

export default async function MonthlyReportPage({ params }: { params: Promise<{ id: string; period: string }> }) {
  const { id, period } = await params;
  if (!isValidPeriod(period)) notFound();
  const { session, project } = await requireAppProject(id);
  const report = await getProjectReport(session, project.id, period);
  const payload = report ? payloadOf(report) : null;
  if (!report || !payload) notFound();
  // A month with nothing done leads with the next fix, not a page of zeros (same nudge as the email).
  const nudge = monthlyNudge(payload);
  const fixHref = payload.topFix ? `/app/projects/${project.id}/todo/${encodeURIComponent(payload.topFix.id)}` : `/app/projects/${project.id}/todo`;

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <LinkButton href={`/app/projects/${project.id}/monthly`} variant="ghost" size="sm">
          ← All monthly reports
        </LinkButton>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/projects/${project.id}/monthly-reports/${period}?format=markdown`} download className={buttonClass("secondary")}>
            <Download aria-hidden className="size-4" />
            Download text file
          </a>
          <PrintButton label="Download PDF" />
        </div>
      </div>
      {report.status !== "sent" && (
        <Notice tone="warning" title="Draft — your customer can't see this yet" className="no-print mb-6">
          This report is waiting for staff review. Approve and send it from the staff review queue.
        </Notice>
      )}
      {nudge && (
        <Notice
          tone="info"
          title={nudge.headline}
          className="no-print mb-6"
          actions={
            <>
              <LinkButton href={fixHref} size="sm">
                {payload.topFix ? "Start fix #1" : "Open your To-do list"}
              </LinkButton>
              <a href={bookCallHref()} target="_blank" rel="noopener noreferrer" className="text-small font-medium text-primary hover:underline">
                Book a free call<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          }
        >
          {nudge.fix ?? "Your first fix is waiting on your To-do list."} {nudge.help}
        </Notice>
      )}
      <MonthlyReportView payload={payload} summary={report.summary ?? ""} branding={toPublicBranding(await getBranding(session.organizationId))} />
    </>
  );
}
