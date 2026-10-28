// Staff review queue for monthly impact reports (all organizations).
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange, FilePlus2 } from "lucide-react";
import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/auth/staff";
import { QUEUE_STATUSES, listQueue, queueFilterSchema } from "@/lib/monthly-report/admin";
import { periodLabel, previousPeriod } from "@/lib/monthly-report/period";
import { GenerateNowForm } from "@/components/app/monthly/review-editor";
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, LinkButton, PageHeader, Select, Table, TD, TH, THead, TR,
} from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monthly reports" };

const fmt = (d: Date | null) => (d ? d.toISOString().replace("T", " ").slice(0, 16) : "—");
const TONE: Record<string, "warning" | "info" | "success"> = { draft: "warning", reviewed: "info", sent: "success" };

export default async function MonthlyQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await getStaffUser())) notFound();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const parsed = queueFilterSchema.safeParse({ period: one(sp.period), status: one(sp.status) });
  const filters = parsed.success ? parsed.data : {};
  const [rows, projects] = await Promise.all([
    listQueue(filters),
    db.project.findMany({
      select: { id: true, name: true, organization: { select: { name: true, serviceTier: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);
  const projectOptions = projects
    .map((p) => ({
      id: p.id,
      label: `${p.organization.name} — ${p.name}${p.organization.serviceTier ? ` (${p.organization.serviceTier})` : ""}`,
      service: !!p.organization.serviceTier,
    }))
    .sort((a, b) => Number(b.service) - Number(a.service) || a.label.localeCompare(b.label));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Service delivery"
        title="Monthly impact reports"
        description="Reports are generated automatically on days 1–3 of each month (UTC). Done-for-you clients' reports wait here for review; self-serve reports are sent automatically."
        className="mb-0"
      />

      <Card>
        <CardHeader icon={<CalendarRange />} title="Queue" description={filters.status ? `Status: ${filters.status}` : "Showing drafts and reviewed reports"} />
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <Field label="Month" htmlFor="q-period">
              <Input id="q-period" name="period" type="month" defaultValue={filters.period ?? ""} />
            </Field>
            <Field label="Status" htmlFor="q-status">
              <Select id="q-status" name="status" defaultValue={filters.status ?? ""}>
                <option value="">Awaiting review</option>
                {QUEUE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
            {(filters.period || filters.status) && (
              <LinkButton href="/admin/monthly-reports" variant="ghost">
                Clear
              </LinkButton>
            )}
          </form>
        </CardBody>
        {rows.length === 0 ? (
          <EmptyState size="sm" title="Nothing here" description="No reports match these filters." />
        ) : (
          <Table caption="Monthly reports" zebra stickyHeader maxHeight="40rem">
            <THead>
              <tr>
                <TH>Client</TH>
                <TH>Month</TH>
                <TH>Status</TH>
                <TH>Drafted</TH>
                <TH>Sent</TH>
                <TH align="right">
                  <span className="sr-only">Open</span>
                </TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <div className="font-medium text-fg">{r.projectName}</div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      {r.orgName}
                      {r.serviceTier && (
                        <Badge size="sm" tone="primary" className="capitalize">
                          {r.serviceTier}
                        </Badge>
                      )}
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">{periodLabel(r.period)}</TD>
                  <TD>
                    <Badge size="sm" tone={TONE[r.status] ?? "info"} variant="dot" className="capitalize">
                      {r.status}
                    </Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-muted tabular-nums">{fmt(r.createdAt)}</TD>
                  <TD className="whitespace-nowrap text-xs text-muted tabular-nums">{fmt(r.sentAt)}</TD>
                  <TD align="right">
                    <Link href={`/admin/monthly-reports/${r.id}`} className="text-small font-semibold text-primary hover:underline">
                      {r.status === "sent" ? "View" : "Review"}
                    </Link>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={<FilePlus2 />}
          title="Generate now"
          description="Build or refresh a draft for any project and month. It always stays a draft for review; a report that was already sent is left unchanged."
        />
        <CardBody>
          {projectOptions.length ? (
            <GenerateNowForm projects={projectOptions.map(({ id, label }) => ({ id, label }))} defaultPeriod={previousPeriod()} />
          ) : (
            <p className="text-small text-muted">No projects yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
