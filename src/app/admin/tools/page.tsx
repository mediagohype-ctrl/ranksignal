// Free tool usage: every free check and free public tool run (src/lib/admin/tool-usage.ts) — who used what, on
// which website, what it cost in AI, and whether they left an email. Filters by tool, outcome and range.
import Link from "next/link";
import { Activity, IndianRupee, MailCheck, Users, Wrench } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { formatInr, microsToInr } from "@/lib/admin/money";
import { fmtDateTime, pageParams, pctDelta, rangeParam, str, type SearchParams } from "@/lib/admin/params";
import { TOOL_LABELS, toolLabel } from "@/lib/admin/tool-usage";
import { Badge, Card, CardHeader, EmptyState, PageHeader, ScoreRing, Stat, Table, TD, TH, THead, TR } from "@/components/ui";
import { FilterBar, FilterInput, FilterSelect, Pagination, RangePicker } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Free tool usage" };

const inrPrecise = (micros: number) => {
  const v = microsToInr(micros);
  return v === 0 ? "₹0" : v < 1 ? `₹${v.toFixed(2)}` : formatInr(v);
};

export default async function ToolUsagePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage("leads.view");
  const sp = await searchParams;
  const r = rangeParam(sp, "7");
  const { page, size, skip, take } = pageParams(sp);

  const tool = str(sp, "tool");
  const outcome = str(sp, "outcome");
  const q = str(sp, "q")?.trim();
  const where: Prisma.ToolUseWhereInput = {
    createdAt: { gte: r.since, lt: r.now },
    ...(tool ? { tool } : {}),
    ...(outcome === "ok" ? { ok: true } : outcome === "failed" ? { ok: false } : outcome === "email" ? { email: { not: null } } : {}),
    ...(q
      ? {
          OR: [
            { url: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { userEmail: { contains: q, mode: "insensitive" } },
            { input: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const period = { createdAt: { gte: r.since, lt: r.now } };

  const [rows, total, totals, prevCount, visitors, emails, byTool, today] = await Promise.all([
    db.toolUse.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.toolUse.count({ where }),
    db.toolUse.aggregate({ where: period, _count: { _all: true }, _sum: { aiCostMicros: true } }),
    db.toolUse.count({ where: { createdAt: { gte: r.prevSince, lt: r.since } } }),
    db.toolUse.groupBy({ by: ["ipHash"], where: { ...period, ipHash: { not: null } } }),
    db.toolUse.count({ where: { ...period, email: { not: null } } }),
    db.toolUse.groupBy({
      by: ["tool"],
      where: period,
      _count: { _all: true },
      _sum: { aiCostMicros: true },
      orderBy: { _count: { tool: "desc" } },
    }),
    db.toolUse.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } } }),
  ]);
  const okByTool = new Map(
    (await db.toolUse.groupBy({ by: ["tool"], where: { ...period, ok: true }, _count: { _all: true } })).map((t) => [t.tool, t._count._all]),
  );
  const runs = totals._count._all;
  const costMicros = totals._sum.aiCostMicros ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Free tool usage"
        description="Every free website check and free tool run: the website, the visitor (device, country, signed-in account, email if they left one) and the AI cost. The team gets an email for each free check and for each new visitor on a tool. IP addresses are stored only as a salted hash."
        meta={<Badge tone="info">{today.toLocaleString()} in the last 24 hours</Badge>}
        actions={<RangePicker basePath="/admin/tools" sp={sp} active={r.key} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`Runs · ${r.days}d`} value={runs.toLocaleString()} delta={pctDelta(runs, prevCount)} deltaLabel={`vs previous ${r.days}d`} icon={<Activity />} />
        <Stat label="Unique visitors" value={visitors.length.toLocaleString()} icon={<Users />} hint="Counted by hashed IP" />
        <Stat label="Left their email" value={emails.toLocaleString()} icon={<MailCheck />} hint={runs ? `${Math.round((emails / runs) * 100)}% of runs` : undefined} />
        <Stat label={`AI cost · ${r.days}d`} value={inrPrecise(costMicros)} icon={<IndianRupee />} hint={runs ? `${inrPrecise(costMicros / runs)} per run on average` : undefined} />
      </div>

      <Card>
        <CardHeader title="By tool" description="Click a tool to see only its runs." />
        {byTool.length === 0 ? (
          <EmptyState size="sm" icon={<Wrench />} title="No tool runs in this period" />
        ) : (
          <Table caption="Runs by tool" density="compact" zebra>
            <THead>
              <tr>
                <TH>Tool</TH>
                <TH align="right">Runs</TH>
                <TH align="right">Worked</TH>
                <TH align="right">AI cost</TH>
              </tr>
            </THead>
            <tbody>
              {byTool.map((t) => (
                <TR key={t.tool}>
                  <TD>
                    <Link href={`/admin/tools?range=${r.key}&tool=${t.tool}`} className="font-medium text-fg hover:text-primary hover:underline">
                      {toolLabel(t.tool)}
                    </Link>
                  </TD>
                  <TD numeric>{t._count._all.toLocaleString()}</TD>
                  <TD numeric>{(okByTool.get(t.tool) ?? 0).toLocaleString()}</TD>
                  <TD numeric>{inrPrecise(t._sum.aiCostMicros ?? 0)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <FilterBar action="/admin/tools" resetHref="/admin/tools">
          <input type="hidden" name="range" value={r.key} />
          <FilterInput name="q" label="Search" defaultValue={q} placeholder="Website, email, keyword" type="search" />
          <FilterSelect name="tool" label="Tool" defaultValue={tool} options={Object.entries(TOOL_LABELS).map(([value, label]) => ({ value, label }))} />
          <FilterSelect name="outcome" label="Outcome" defaultValue={outcome} options={[{ value: "ok", label: "Worked" }, { value: "failed", label: "Failed" }, { value: "email", label: "Left email" }]} />
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon={<Wrench />} title="No runs match" description="Free checks and free tool runs appear here as soon as someone uses them." />
        ) : (
          <Table caption="Tool runs" stickyHeader zebra density="compact" maxHeight="70vh">
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Tool</TH>
                <TH>Website / input</TH>
                <TH>Visitor</TH>
                <TH>Score</TH>
                <TH align="right">AI cost</TH>
                <TH>Result</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((u) => (
                <TR key={u.id}>
                  <TD className="whitespace-nowrap text-xs tabular-nums text-muted">{fmtDateTime(u.createdAt)}</TD>
                  <TD className="whitespace-nowrap text-xs">{toolLabel(u.tool)}</TD>
                  <TD className="max-w-[18rem] text-xs">
                    {u.url ? (
                      <a href={/^https?:\/\//.test(u.url) ? u.url : `https://${u.url}`} target="_blank" rel="noreferrer noopener" className="block truncate text-primary hover:underline">
                        {u.url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : null}
                    {u.input ? <div className="truncate text-muted">{u.input}</div> : null}
                    {!u.url && !u.input ? "—" : null}
                  </TD>
                  <TD className="max-w-[16rem] text-xs">
                    {u.email || u.userEmail ? (
                      <div className="truncate font-medium text-fg">
                        {u.leadId && u.email ? (
                          <Link href={`/admin/leads/${u.leadId}`} className="hover:text-primary hover:underline">
                            {u.email}
                          </Link>
                        ) : (
                          (u.email ?? u.userEmail)
                        )}
                        {u.userEmail && !u.email ? <Badge tone="accent" size="sm" className="ml-1">user</Badge> : null}
                      </div>
                    ) : (
                      <div className="text-muted">Anonymous</div>
                    )}
                    <div className="truncate text-muted">
                      {[u.device, u.browser, u.country, u.referrer ? `from ${u.referrer}` : null].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </TD>
                  <TD>{u.score != null ? <ScoreRing score={u.score} size="sm" label="Score" /> : <span className="text-muted">—</span>}</TD>
                  <TD numeric className="text-xs">
                    {u.aiCostMicros ? inrPrecise(u.aiCostMicros) : <span className="text-muted">₹0</span>}
                  </TD>
                  <TD>
                    {u.ok ? (
                      <Badge tone="success" size="sm">Worked</Badge>
                    ) : (
                      <Badge tone="danger" size="sm" title={u.errorCode ?? undefined}>
                        {u.errorCode?.replace(/_/g, " ") ?? "Failed"}
                      </Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination basePath="/admin/tools" sp={sp} page={page} size={size} total={total} />
      </Card>
    </div>
  );
}
