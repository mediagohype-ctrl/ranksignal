import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, LifeBuoy } from "lucide-react";
import { db } from "@/lib/db";
import { hasRole, requireAppProject } from "@/lib/dashboard/server";
import { asArray, ACTIVE_RUN_STATUSES } from "@/lib/dashboard/format";
import { changeOf, hashOf, targetOf } from "@/lib/actions/gate";
import { loadIssue } from "@/lib/report/issue-page";
import { IMPACT_LABEL } from "@/lib/report/issues";
import { pointsLabel } from "@/lib/report/points";
import { resolveFix } from "@/lib/fix-guides";
import { canEditTasks, readEvidence } from "@/lib/tasks";
import { issueForAction, nextTodo, parseTodoId, timeLabel, todoHref, type TodoItem } from "@/lib/tasks/todo";
import { loadTodo } from "@/lib/tasks/todo-server";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { FixScreen, type FixMode, type FixScreenProps } from "@/components/app/fix/fix-screen";
import { issueHref, todoItemHref } from "@/components/app/nav";
import { Card, RiskBadge } from "@/components/ui";

export const metadata = { title: "Fix" };

/** Drafted changes that still need a decision or can still be put live. */
const PENDING = ["proposed", "awaiting_approval", "approved", "blocked"];
/** Problems that need new writing (a page plan), not a small text change. */
const WRITE_TYPES = new Set(["content_brief", "comparison_page_brief"]);
const IMPACT_TONE = { high: "bg-danger-soft text-danger", medium: "bg-warning-soft text-warning", low: "bg-surface-2 text-muted" } as const;

/** Which label the Before → After box gets (src/components/app/diff-view.tsx) when the change comes from a guide. */
function fieldFor(issueId: string): string {
  if (issueId === "seo-titles" || issueId === "brand-name_consistency") return "title";
  if (issueId === "seo-meta_description") return "meta_description";
  if (/structured_data|faq_schema|organization_schema|entity_clarity/.test(issueId)) return "schema";
  if (/ai_search_access|ai_training_access/.test(issueId)) return "robots";
  return "content";
}

/** First sentence only: the fix screen says what's wrong in one line. */
function firstSentence(s: string) {
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
}

function pathOf(url: string) {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "Home page" : u.pathname;
  } catch {
    return url;
  }
}

const sameUrl = (a: string, b: string) => a.replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase() === b.replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();

// The fix screen (Developer Brief v1): what's wrong in one line → Before → After → ONE button. After a fix we
// look at the page again and open the next fix. The detailed platform guide stays one link away.
export default async function TodoItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const [{ id, itemId: raw }, sp] = await Promise.all([params, searchParams]);
  const itemId = decodeURIComponent(raw);
  const { session, project } = await requireAppProject(id);
  const parsed = parseTodoId(itemId);
  if (!parsed) notFound();
  const org = session.organizationId;
  const todo = await loadTodo(session, project.id);
  const canEdit = canEditTasks(session);
  const canPublish = hasRole(session, "admin") || !!session.staffMode;

  // Old "Fixes to approve" links point at one drafted change: open the problem it belongs to.
  if (parsed.kind === "action") {
    const a = await db.action.findFirst({ where: { id: parsed.actionId, organizationId: org, projectId: project.id }, select: { id: true, type: true, target: true } });
    if (!a) redirect(todoHref(project.id));
    const issue = issueForAction({ type: a.type, targetUrl: targetOf(a)?.url ?? null }, todo.report?.issues ?? []);
    redirect(issue ? `${todoItemHref(project.id, issue.id)}?action=${encodeURIComponent(a.id)}` : todoHref(project.id));
  }

  const item: TodoItem | undefined = todo.items.find((i) => i.id === itemId);
  if (!item) notFound();
  const next = nextTodo(todo.items, item.id);
  const nextHref = next ? todoItemHref(project.id, next.id) : todoHref(project.id);
  const listHref = todoHref(project.id, { tab: item.side });
  const done = item.state === "done";

  let line: string;
  let screen: Omit<FixScreenProps, "projectId" | "itemId" | "canEdit" | "canPublish" | "done" | "recheck" | "nextHref">;
  let helpHref: string | null = null;
  let external: { href: string; label: string } | null = null;
  let risk: string | null = null;
  let pageLabel: string | null = null;
  let writing = false;

  const none = { diff: null, action: null, lastAction: true, writing: false, recheckUrl: null, canRecheck: false } as const;

  if (parsed.kind === "issue") {
    const data = await loadIssue(org, project.id, parsed.issueId);
    if (!data) {
      // Done earlier and gone from the latest check: show it as done.
      line = "This problem doesn't show up in your latest website check.";
      screen = { ...none, mode: "manual" };
    } else {
      const { issue, pages } = data;
      line = firstSentence(issue.whatsWrong);
      helpHref = `${issueHref(project.id, issue.id)}/fix`;
      const brand = asArray<string>(project.brandNames)[0] ?? project.name;
      const fix = resolveFix({ brand, websiteUrl: project.websiteUrl, platform: "custom", issue, pages });

      const rows = issue.relatedActionType
        ? await db.action.findMany({
            where: { organizationId: org, projectId: project.id, type: issue.relatedActionType, status: { in: PENDING } },
            orderBy: [{ priorityScore: "desc" }, { updatedAt: "desc" }],
            take: 50,
          })
        : [];
      const pageLevel = issue.affectedUrls.length > 0;
      const drafted = rows
        .map((a) => ({ a, change: changeOf(a), url: targetOf(a)?.url ?? null }))
        .filter((x) => typeof x.change?.after === "string" && x.change.after.trim())
        .filter((x) => WRITE_TYPES.has(issue.relatedActionType ?? "") || !pageLevel || !x.url || issue.affectedUrls.some((u) => sameUrl(u, x.url!)));
      const chosen = drafted.find((x) => x.a.id === sp.action) ?? drafted[0] ?? null;

      const write = WRITE_TYPES.has(issue.relatedActionType ?? "");
      let mode: FixMode = "manual";
      let diff: FixScreenProps["diff"] = null;
      let recheckUrl: string | null = pages[0]?.url ?? null;
      if (chosen) {
        const connected = !!chosen.a.integrationId && chosen.a.policyDecision !== "blocked" && chosen.a.status !== "blocked";
        mode = write ? (chosen.a.status === "awaiting_approval" ? "approve" : "manual") : connected ? "auto" : "manual";
        diff = { field: chosen.change!.field ?? fieldFor(issue.id), before: chosen.change!.before ?? null, after: chosen.change!.after };
        if (chosen.url) recheckUrl = chosen.url;
        risk = mode === "auto" || mode === "approve" ? chosen.a.riskClass : null;
      } else if (write) {
        const [active, lastRun] = await Promise.all([
          db.workflowRun.findFirst({ where: { organizationId: org, projectId: project.id, kind: "analyze", state: { in: ACTIVE_RUN_STATUSES } }, select: { id: true } }),
          db.workflowRun.findFirst({ where: { organizationId: org, projectId: project.id, kind: "analyze" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        ]);
        writing = !!active;
        // Already asked since this check and nothing came back: do it by hand with the step-by-step help.
        const triedSinceCheck = !!lastRun && !!data.report.generatedAt && lastRun.createdAt.toISOString() > data.report.generatedAt && !writing;
        mode = triedSinceCheck ? "manual" : "write";
      }
      if (!diff) {
        const row = fix.changes.find((c) => recheckUrl && pathOf(recheckUrl) === c.page) ?? fix.changes[0];
        if (row) diff = { field: fieldFor(issue.id), before: /^\(.*\)$/.test(row.now.trim()) ? null : row.now, after: row.change };
      }
      if (recheckUrl && pageLevel) pageLabel = issue.affectedCount > 1 ? `${pathOf(recheckUrl)} · 1 of ${issue.affectedCount} pages` : pathOf(recheckUrl);
      screen = {
        mode,
        diff,
        action: chosen ? { id: chosen.a.id, status: chosen.a.status, draftHash: hashOf(chosen.a), policyDecision: chosen.a.policyDecision } : null,
        lastAction: drafted.length <= 1,
        writing,
        recheckUrl,
        canRecheck: pageLevel,
      };
    }
  } else if (parsed.kind === "offsite") {
    const row = await db.offsiteItem.findFirst({ where: { id: parsed.offsiteId, organizationId: org, projectId: project.id } });
    if (!row) notFound();
    line = `You're not listed on ${row.name} yet. Customers and AI tools look businesses up there.`;
    if (row.url && /^https?:\/\//i.test(row.url)) external = { href: row.url, label: `Open ${row.name}` };
    screen = { ...none, mode: "manual" };
  } else {
    const t = await db.task.findFirst({ where: { id: parsed.taskId, organizationId: org, projectId: project.id } });
    if (!t) notFound();
    line = firstSentence(t.description?.trim() || "A task on your list.");
    const link = readEvidence(t.evidence).links[0] ?? t.shippedUrl;
    if (link) external = { href: link, label: "Open the page" };
    screen = { ...none, mode: "manual" };
  }

  return (
    <div className="mx-auto max-w-[720px] space-y-6">
      {writing && <AutoRefresh active intervalMs={5000} label="Writing your draft…" />}
      <Link href={listHref} className="inline-flex items-center gap-1.5 text-small font-medium text-muted hover:text-fg">
        <ArrowLeft size={16} aria-hidden /> Back to your to-do list
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex h-6 items-center rounded-full px-2.5 font-semibold ${IMPACT_TONE[item.impact]}`}>{IMPACT_LABEL[item.impact]}</span>
          {risk && <RiskBadge riskClass={risk} />}
          <span className="inline-flex items-center gap-1 text-muted">
            <Clock size={12} aria-hidden /> {timeLabel(item.minutes)}
          </span>
          {item.points > 0 && <span className="font-semibold text-success">{pointsLabel(item.points)}</span>}
        </div>
        <h1 className="text-h2 text-balance text-fg">{item.title}</h1>
        <p className="text-body text-fg-soft">{line}</p>
        {pageLabel && <p className="text-small text-muted">{pageLabel}</p>}
      </header>

      <Card as="section" padding="md" aria-label="The fix">
        <FixScreen
          projectId={project.id}
          itemId={item.id}
          {...screen}
          canEdit={canEdit}
          canPublish={canPublish}
          done={done}
          recheck={item.recheck ?? null}
          nextHref={nextHref}
        />
      </Card>

      {(helpHref || external) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-small font-medium">
          {helpHref && (
            <Link href={helpHref} className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <LifeBuoy size={14} aria-hidden /> See step-by-step help
            </Link>
          )}
          {external && (
            <a href={external.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <ExternalLink size={14} aria-hidden /> {external.label}
              <span className="sr-only">(opens in new tab)</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
