// Leads CRM: free-check and contact-form leads with filters, pipeline counts and CSV export.
import Link from "next/link";
import { Download, Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { leadWhere } from "@/lib/admin/lead-filters";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/admin/leads";
import { fmtDateTime, pageParams, qs, str, type SearchParams } from "@/lib/admin/params";
import { Badge, buttonClass, Card, EmptyState, PageHeader, ScoreRing, Table, TD, TH, THead, TR } from "@/components/ui";
import { FilterBar, FilterInput, FilterSelect, Pagination, StatusPill } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const { page, size, skip, take } = pageParams(sp);
  const where = leadWhere(sp);
  const [leads, total, byStatus, bySource] = await Promise.all([
    db.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.lead.count({ where }),
    db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    db.lead.groupBy({ by: ["source"], _count: { _all: true } }),
  ]);
  const statusCount = new Map(byStatus.map((s) => [s.status, s._count._all]));
  const sourceCount = new Map(bySource.map((s) => [s.source, s._count._all]));
  const exportQs = qs(sp, { page: undefined, size: undefined });

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Leads"
        description="People who ran a free check or wrote in through the contact form. IP addresses are stored only as a salted hash."
        meta={
          <>
            {LEAD_SOURCES.map((s) => (
              <Badge key={s} tone="neutral">
                {s.replace("_", " ")} · {sourceCount.get(s) ?? 0}
              </Badge>
            ))}
          </>
        }
        actions={
          <a href={`/api/admin/leads/export${exportQs}`} className={buttonClass("secondary", "sm")}>
            <Download aria-hidden className="size-4" /> Export CSV
          </a>
        }
      />
      <nav aria-label="Pipeline" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {LEAD_STATUSES.map((s, i) => {
          const on = str(sp, "status") === s;
          return (
            <Link
              key={s}
              href={`/admin/leads${qs(sp, { status: on ? undefined : s, page: undefined })}`}
              aria-current={on ? "true" : undefined}
              className={
                on
                  ? "rounded-2xl border border-primary bg-primary-soft p-4 shadow-card"
                  : "rounded-2xl border border-border bg-surface p-4 shadow-card hover:shadow-card-hover"
              }
            >
              <div className="text-caption uppercase tracking-[0.06em] text-muted">
                {i + 1}. {s}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-fg">{(statusCount.get(s) ?? 0).toLocaleString()}</div>
            </Link>
          );
        })}
      </nav>
      <Card>
        <FilterBar action="/admin/leads" resetHref="/admin/leads">
          <FilterInput name="q" label="Search" defaultValue={str(sp, "q")} placeholder="Email, name, company, URL" type="search" />
          <FilterSelect name="source" label="Source" defaultValue={str(sp, "source")} options={[...LEAD_SOURCES]} />
          <FilterSelect name="status" label="Status" defaultValue={str(sp, "status")} options={[...LEAD_STATUSES]} />
          <FilterInput name="from" label="From" type="date" defaultValue={str(sp, "from")} />
          <FilterInput name="to" label="To" type="date" defaultValue={str(sp, "to")} />
        </FilterBar>
        {leads.length === 0 ? (
          <EmptyState icon={<Inbox />} title="No leads match" description="New free checks and contact messages appear here automatically." />
        ) : (
          <Table caption="Leads" stickyHeader zebra density="compact" maxHeight="70vh">
            <THead>
              <tr>
                <TH>Lead</TH>
                <TH>Source</TH>
                <TH>Website</TH>
                <TH>Score</TH>
                <TH>Status</TH>
                <TH>Received</TH>
              </tr>
            </THead>
            <tbody>
              {leads.map((l) => (
                <TR key={l.id}>
                  <TD>
                    <Link href={`/admin/leads/${l.id}`} className="font-medium text-fg hover:text-primary hover:underline">
                      {l.email ?? l.name ?? "Anonymous free check"}
                    </Link>
                    <div className="max-w-xs truncate text-xs text-muted">
                      {[l.name && l.email ? l.name : null, l.company, l.message?.slice(0, 80)].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={l.source === "contact" ? "accent" : "info"}>{l.source.replace("_", " ")}</Badge>
                  </TD>
                  <TD className="max-w-[16rem] truncate text-xs">
                    {l.url ? (
                      <a href={l.url} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                        {l.url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD>{l.score != null ? <ScoreRing score={l.score} size="sm" label="Free check score" /> : <span className="text-muted">—</span>}</TD>
                  <TD>
                    <StatusPill status={l.status} />
                  </TD>
                  <TD className="whitespace-nowrap text-xs tabular-nums text-muted">{fmtDateTime(l.createdAt)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination basePath="/admin/leads" sp={sp} page={page} size={size} total={total} />
      </Card>
    </div>
  );
}
