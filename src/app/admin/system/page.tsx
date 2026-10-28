// System: configuration checklist (never reveals secret values), DB connectivity, queue depth, scheduler, version.
import { CheckCircle2, AlertTriangle, XCircle, Info, Database, Server, Timer, GitCommit } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { configChecklist, type CheckStatus, type ConfigCheck } from "@/lib/admin/system";
import { fmtAgo, fmtDateTime } from "@/lib/admin/params";
import { Card, CardBody, CardHeader, EmptyState, KeyValueList, PageHeader, Stat, StatusBadge, Table, TD, TH, THead, TR } from "@/components/ui";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";
export const metadata = { title: "System" };

const ICON: Record<CheckStatus, React.ReactNode> = {
  ok: <CheckCircle2 aria-hidden className="size-4 text-success" />,
  warn: <AlertTriangle aria-hidden className="size-4 text-warning" />,
  missing: <XCircle aria-hidden className="size-4 text-danger" />,
  info: <Info aria-hidden className="size-4 text-info" />,
};
const LABEL: Record<CheckStatus, string> = { ok: "OK", warn: "Check", missing: "Missing", info: "Info" };

async function dbPing(): Promise<{ ok: boolean; ms: number }> {
  const t = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true, ms: Date.now() - t };
  } catch {
    return { ok: false, ms: Date.now() - t };
  }
}

export default async function SystemPage() {
  await requireStaffPage();
  const ping = await dbPing();
  const [depth, oldestQueued, lastScheduled, stuck, lastRecovery] = ping.ok
    ? await Promise.all([
        db.workflowRun.groupBy({ by: ["state"], _count: { _all: true } }),
        db.workflowRun.findFirst({ where: { state: { in: ["queued", "retry_scheduled"] }, runAfter: { lte: new Date() } }, orderBy: { runAfter: "asc" }, select: { runAfter: true, kind: true } }),
        db.workflowRun.findFirst({ where: { idempotencyKey: { startsWith: "sched:" } }, orderBy: { createdAt: "desc" }, select: { createdAt: true, kind: true } }),
        db.workflowRun.count({ where: { state: { in: ["running", "preflight", "executing", "validating"] }, lockedAt: { lt: new Date(Date.now() - 10 * 60_000) } } }),
        db.workflowEvent.findFirst({ where: { name: { contains: "interrupt" } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      ])
    : [[], null, null, 0, null];
  const checks = configChecklist();
  const groups = [...new Set(checks.map((c) => c.group))];
  const counts = (s: CheckStatus) => checks.filter((c) => c.status === s).length;
  const commit = process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA;
  const queueActive = depth.filter((d) => ["queued", "retry_scheduled", "running", "preflight", "executing", "validating"].includes(d.state)).reduce((a, d) => a + d._count._all, 0);

  return (
    <div className="space-y-6">
      <PageHeader className="mb-0" title="System" description="Configuration and runtime health. Secret values are never shown — only whether they are set." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Database" value={ping.ok ? "Connected" : "Unreachable"} icon={<Database />} hint={`Round trip ${ping.ms} ms`} />
        <Stat label="Queue (active)" value={queueActive.toLocaleString()} icon={<Server />} hint={oldestQueued ? `Oldest due ${fmtAgo(oldestQueued.runAfter)} (${oldestQueued.kind})` : "Nothing waiting"} />
        <Stat
          label="Scheduler"
          value={process.env.SCHEDULER_DISABLED === "true" ? "Disabled" : lastScheduled ? "Running" : "No runs yet"}
          icon={<Timer />}
          hint={lastScheduled ? `Last scheduled ${lastScheduled.kind} ${fmtAgo(lastScheduled.createdAt)}` : "Enqueues due scans every 5 minutes"}
        />
        <Stat label="App version" value={pkg.version} icon={<GitCommit />} hint={commit ? `commit ${commit.slice(0, 7)}` : `Node ${process.version} · ${process.env.NODE_ENV}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Configuration checklist" description={`${counts("ok")} OK · ${counts("warn")} to check · ${counts("missing")} missing`} />
          <Table caption="Configuration checklist" density="compact">
            <THead>
              <tr>
                <TH>Setting</TH>
                <TH>Status</TH>
                <TH>Detail</TH>
              </tr>
            </THead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g} group={g} checks={checks.filter((c) => c.group === g)} />
              ))}
            </tbody>
          </Table>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Runtime" />
            <CardBody>
              <KeyValueList
                items={[
                  { label: "Node", value: process.version },
                  { label: "Environment", value: process.env.NODE_ENV ?? "—" },
                  { label: "Uptime", value: `${Math.round(process.uptime() / 60)} min` },
                  { label: "Memory (RSS)", value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB` },
                  { label: "Stale locks", value: stuck, hint: "In-progress runs with no heartbeat for 10+ min" },
                  { label: "Last interrupted-run recovery", value: lastRecovery ? fmtDateTime(lastRecovery.createdAt) : "—" },
                  { label: "Server time (UTC)", value: fmtDateTime(new Date()) },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Queue depth" description="Workflow runs by state" />
            {depth.length === 0 ? (
              <EmptyState size="sm" title="No workflow runs" />
            ) : (
              <Table caption="Queue depth" density="compact">
                <THead>
                  <tr>
                    <TH>State</TH>
                    <TH align="right">Runs</TH>
                  </tr>
                </THead>
                <tbody>
                  {[...depth]
                    .sort((a, b) => b._count._all - a._count._all)
                    .map((d) => (
                      <TR key={d.state}>
                        <TD>
                          <StatusBadge status={d.state} />
                        </TD>
                        <TD numeric>{d._count._all.toLocaleString()}</TD>
                      </TR>
                    ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function GroupRows({ group, checks }: { group: string; checks: ConfigCheck[] }) {
  return (
    <>
      <tr>
        <th colSpan={3} scope="colgroup" className="bg-surface-2 px-5 py-1.5 text-left text-caption uppercase tracking-[0.06em] text-muted">
          {group}
        </th>
      </tr>
      {checks.map((c) => (
        <TR key={c.key}>
          <TD>
            <div className="font-medium text-fg">{c.label}</div>
            <div className="font-mono text-xs text-muted">{c.key}</div>
          </TD>
          <TD>
            <span className="inline-flex items-center gap-1.5 text-small font-medium">
              {ICON[c.status]} {LABEL[c.status]}
            </span>
          </TD>
          <TD className="break-all text-small text-fg-soft">{c.detail}</TD>
        </TR>
      ))}
    </>
  );
}
