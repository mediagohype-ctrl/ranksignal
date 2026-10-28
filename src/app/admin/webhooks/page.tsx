// Webhooks: received provider events (idempotency ledger) with a payload viewer.
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Webhook } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { dateRangeWhere, fmtDateTime, pageParams, qs, str, type SearchParams } from "@/lib/admin/params";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Table, TD, TH, THead, TR } from "@/components/ui";
import { FilterBar, FilterInput, FilterSelect, JsonView, Mono, Pagination } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Webhooks" };

export default async function WebhooksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const { page, size, skip, take } = pageParams(sp, 50);
  const where: Prisma.WebhookEventWhereInput = {};
  const provider = str(sp, "provider");
  if (provider) where.provider = provider;
  const type = str(sp, "type");
  if (type) where.type = { startsWith: type };
  const processed = dateRangeWhere(sp);
  if (processed) where.processedAt = processed;
  const selectedId = str(sp, "id");

  const [rows, total, providers, selected] = await Promise.all([
    db.webhookEvent.findMany({
      where,
      orderBy: { processedAt: "desc" },
      skip,
      take,
      select: { id: true, provider: true, eventId: true, type: true, processedAt: true },
    }),
    db.webhookEvent.count({ where }),
    db.webhookEvent.groupBy({ by: ["provider"], _count: { _all: true } }),
    selectedId ? db.webhookEvent.findUnique({ where: { id: selectedId } }) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader className="mb-0" title="Webhooks" description="Signed provider events we accepted (each is stored once for replay protection)." />
      {selected && (
        <Card>
          <CardHeader
            title={selected.type}
            description={`${selected.provider} · ${selected.eventId} · ${fmtDateTime(selected.processedAt)}`}
            actions={
              <Link href={`/admin/webhooks${qs(sp, { id: undefined })}`} className="text-small font-medium text-primary hover:underline">
                Close
              </Link>
            }
          />
          <CardBody>
            <JsonView label="Payload" value={selected.payload} open maxHeight="32rem" />
          </CardBody>
        </Card>
      )}
      <Card>
        <FilterBar action="/admin/webhooks" resetHref="/admin/webhooks">
          <FilterSelect name="provider" label="Provider" defaultValue={provider} options={providers.map((p) => ({ value: p.provider, label: `${p.provider} (${p._count._all})` }))} />
          <FilterInput name="type" label="Type prefix" defaultValue={type} placeholder="subscription." />
          <FilterInput name="from" label="From" type="date" defaultValue={str(sp, "from")} />
          <FilterInput name="to" label="To" type="date" defaultValue={str(sp, "to")} />
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon={<Webhook />} title="No webhook events match" />
        ) : (
          <Table caption="Webhook events" stickyHeader zebra density="compact" maxHeight="70vh">
            <THead>
              <tr>
                <TH>Type</TH>
                <TH>Provider</TH>
                <TH>Event id</TH>
                <TH>Processed</TH>
                <TH>Payload</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((w) => (
                <TR key={w.id} className={w.id === selectedId ? "bg-primary-soft" : undefined}>
                  <TD className="font-medium text-fg">{w.type}</TD>
                  <TD>{w.provider}</TD>
                  <TD>
                    <Mono>{w.eventId}</Mono>
                  </TD>
                  <TD className="whitespace-nowrap text-xs tabular-nums text-muted">{fmtDateTime(w.processedAt)}</TD>
                  <TD>
                    <Link href={`/admin/webhooks${qs(sp, { id: w.id })}`} className="text-small font-medium text-primary hover:underline">
                      View
                    </Link>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination basePath="/admin/webhooks" sp={sp} page={page} size={size} total={total} />
      </Card>
    </div>
  );
}
