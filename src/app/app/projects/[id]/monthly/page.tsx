import Link from "next/link";
import { CalendarRange, ChevronRight, FileText } from "lucide-react";
import { requireAppProject } from "@/lib/dashboard/server";
import { canSeeDrafts, listProjectReports, payloadOf } from "@/lib/monthly-report/server";
import { periodLabel } from "@/lib/monthly-report/period";
import { DeltaChip } from "@/components/app/monthly/report-view";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Monthly impact reports" };
export const dynamic = "force-dynamic";

const day = (d: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null);
const pct = (n: number | null | undefined) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "—");

export default async function MonthlyArchivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const reports = await listProjectReports(session, project.id);
  const staff = canSeeDrafts(session);

  return (
    <>
      <PageHeader
        eyebrow="Monthly impact reports"
        title="What changed, month by month"
        description={`One report per month for ${project.name}: scores before and after, AI answers, work shipped and what's next.`}
      />
      {staff && (
        <Notice tone="info" title="Support mode" className="mb-6">
          You can see drafts here. Clients only see reports after they&apos;re approved and sent from the staff review queue.
        </Notice>
      )}
      {reports.length === 0 ? (
        <EmptyState
          bordered
          icon={<CalendarRange />}
          title="No monthly reports yet"
          description="Your first report is prepared in the first days of next month, once there's at least one scan or completed piece of work to report on."
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const p = payloadOf(r);
            const mStart = p?.aiVisibility.likeForLike?.start.mentionRate ?? p?.aiVisibility.start?.mentionRate ?? null;
            const mEnd = p?.aiVisibility.likeForLike?.end.mentionRate ?? p?.aiVisibility.end?.mentionRate ?? null;
            return (
              <li key={r.id}>
                <Card variant="interactive" padding="none">
                  <Link href={`/app/projects/${project.id}/monthly/${r.period}`} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
                    <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-soft-fg">
                      <FileText className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-h4 text-fg">{periodLabel(r.period)}</span>
                        {r.status !== "sent" && <Badge tone="warning" size="sm" className="capitalize">{r.status} · staff only</Badge>}
                      </div>
                      <div className="text-small text-muted">
                        {r.sentAt ? `Sent ${day(r.sentAt)}` : `Drafted ${day(r.createdAt)}`}
                        {p ? ` · ${p.work.shipped.length} shipped · ${p.issues.fixed.total} issues fixed` : ""}
                      </div>
                    </div>
                    {p && (
                      <div className="hidden items-center gap-6 sm:flex">
                        <div className="text-right">
                          <div className="text-caption uppercase tracking-[0.06em] text-muted">Score</div>
                          <div className="flex items-center justify-end gap-2 text-small font-semibold tabular-nums text-fg">
                            {p.scores.end.overall ?? "—"} <DeltaChip value={p.scores.overallDelta} />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-caption uppercase tracking-[0.06em] text-muted">AI mentions</div>
                          <div className="flex items-center justify-end gap-2 text-small font-semibold tabular-nums text-fg">
                            {pct(mEnd)} <DeltaChip value={mStart !== null && mEnd !== null ? mEnd - mStart : null} kind="rate" />
                          </div>
                        </div>
                      </div>
                    )}
                    <ChevronRight aria-hidden className="size-5 text-muted" />
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
