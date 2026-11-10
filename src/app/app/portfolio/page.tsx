import { LayoutGrid, Plus } from "lucide-react";
import { requireAppSession } from "@/lib/dashboard/server";
import { getUserTimeZone } from "@/lib/dashboard/tz";
import { fmtRelative } from "@/lib/dashboard/format";
import { periodLabel } from "@/lib/monthly-report/period";
import { loadPortfolio, PORTFOLIO_MAX_PROJECTS } from "@/lib/portfolio/server";
import { summarisePortfolio } from "@/lib/portfolio/build";
import { log } from "@/lib/log";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { PortfolioTable } from "@/components/app/portfolio/portfolio-table";
import { Card, CardBody, EmptyState, LinkButton, Notice, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "All websites" };
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await requireAppSession();
  const header = (
    <PageHeader
      icon={<LayoutGrid />}
      title="All websites"
      description="Every website in your account on one screen: scores, change since the last check, AI mentions, urgent problems and monthly reports."
      actions={
        <LinkButton href="/app/onboarding" icon={<Plus />} variant="outline">
          New website
        </LinkButton>
      }
    />
  );

  let data: Awaited<ReturnType<typeof loadPortfolio>> | null = null;
  let timeZone: string | undefined;
  try {
    [data, timeZone] = await Promise.all([loadPortfolio(session.organizationId), getUserTimeZone(session)]);
  } catch (e) {
    log.error("portfolio.load_failed", { organizationId: session.organizationId, error: e instanceof Error ? e.message : String(e) });
  }

  if (!data) {
    return (
      <>
        {header}
        <Notice tone="danger" title="We couldn't load your websites">
          Please refresh the page in a minute.
        </Notice>
      </>
    );
  }

  if (!data.rows.length) {
    return (
      <>
        {header}
        <EmptyState
          bordered
          size="lg"
          picture="website"
          title="Add your first website to see it here."
          actionLabel="Add a website"
          actionHref="/app/onboarding"
        />
      </>
    );
  }

  const summary = summarisePortfolio(data.rows);
  const monthLabel = periodLabel(data.monthlyPeriod);
  const now = Date.now();
  const lastCheckLabels = Object.fromEntries(
    data.rows.filter((r) => r.lastCheckAt).map((r) => [r.id, fmtRelative(r.lastCheckAt, timeZone, now)]),
  );

  return (
    <>
      {header}
      <AutoRefresh active={summary.running > 0} intervalMs={15000} label="Some websites are being checked — this page updates by itself." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Websites" value={summary.sites} />
        <Stat label="Average score" value={summary.averageScore ?? "—"} hint="Across websites that have been checked" />
        <Stat label="Need attention" value={summary.needsAttention} hint="Urgent problems, or the score fell 5+ points" />
        <Stat label={`${monthLabel} reports not sent`} value={summary.monthlyNotSent} />
      </div>
      {data.truncated && (
        <Notice tone="info" className="mb-4">
          Showing your first {PORTFOLIO_MAX_PROJECTS} websites.
        </Notice>
      )}
      <Card>
        <CardBody>
          <PortfolioTable rows={data.rows} lastCheckLabels={lastCheckLabels} monthLabel={monthLabel} />
        </CardBody>
      </Card>
      <p className="mt-4 text-small text-muted">
        Scores and problem counts come from each website&apos;s last finished check. AI mention rate counts only real answers
        from AI tools, never sample data.
      </p>
    </>
  );
}
