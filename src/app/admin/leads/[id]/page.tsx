// Lead detail: contact info, message, pipeline status and notes; related free checks from the same (hashed) IP.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { fmtDateTime } from "@/lib/admin/params";
import { Badge, Card, CardBody, CardHeader, KeyValueList, PageHeader, ScoreRing } from "@/components/ui";
import { Mono, StatusPill } from "@/components/admin/ui";
import { LeadEditor } from "@/components/admin/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lead" };

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage();
  const { id } = await params;
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) notFound();
  const [related, matchingUser] = await Promise.all([
    lead.ipHash
      ? db.lead.findMany({
          where: { ipHash: lead.ipHash, id: { not: lead.id } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, source: true, url: true, score: true, email: true, createdAt: true },
        })
      : Promise.resolve([]),
    lead.email ? db.user.findUnique({ where: { email: lead.email }, select: { id: true, email: true } }) : Promise.resolve(null),
  ]);
  const title = lead.email ?? lead.name ?? lead.url ?? "Lead";

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        breadcrumbs={[{ label: "Leads", href: "/admin/leads" }, { label: title }]}
        title={title}
        meta={
          <>
            <Badge tone={lead.source === "contact" ? "accent" : "info"}>{lead.source.replace("_", " ")}</Badge>
            <StatusPill status={lead.status} />
            <span>Received {fmtDateTime(lead.createdAt)}</span>
            {matchingUser && (
              <Link href={`/admin/users/${matchingUser.id}`} className="font-medium text-success hover:underline">
                Has an account →
              </Link>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-start gap-6">
                {lead.score != null && <ScoreRing score={lead.score} size="md" label="Free check score" caption="Free check" />}
                <KeyValueList
                  className="min-w-64 flex-1"
                  items={[
                    { label: "Name", value: lead.name ?? "—" },
                    { label: "Email", value: lead.email ? <a className="text-primary hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : "—" },
                    { label: "Company", value: lead.company ?? "—" },
                    {
                      label: "Website",
                      value: lead.url ? (
                        <a href={lead.url} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                          {lead.url}
                        </a>
                      ) : (
                        "—"
                      ),
                    },
                    { label: "IP fingerprint", value: lead.ipHash ? <Mono>{lead.ipHash.slice(0, 12)}…</Mono> : "—", hint: "Salted hash — the raw IP is never stored." },
                    { label: "Last updated", value: fmtDateTime(lead.updatedAt) },
                  ]}
                />
              </div>
              {lead.message && (
                <div className="rounded-xl border border-border bg-surface-2 p-4">
                  <div className="mb-1 text-caption uppercase tracking-[0.06em] text-muted">Message</div>
                  <p className="whitespace-pre-wrap text-small text-fg">{lead.message}</p>
                </div>
              )}
            </CardBody>
          </Card>
          {related.length > 0 && (
            <Card>
              <CardHeader title="Other leads from the same connection" description="Matched by hashed IP." />
              <ul className="divide-y divide-border">
                {related.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-small sm:px-6">
                    <Link href={`/admin/leads/${r.id}`} className="font-medium text-fg hover:text-primary hover:underline">
                      {r.email ?? r.url ?? r.id}
                    </Link>
                    <span className="text-xs text-muted">
                      {r.source.replace("_", " ")} {r.score != null && `· score ${r.score}`} · {fmtDateTime(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader title="Pipeline & notes" description="Changes are audit-logged." />
          <CardBody>
            <LeadEditor id={lead.id} status={lead.status} notes={lead.notes} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
