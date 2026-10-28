import { HttpError } from "@/lib/api";
import { requireAppProject } from "@/lib/dashboard/server";
import {
  canDeleteTasks,
  canEditTasks,
  canSeeInternal,
  listAssignees,
  listShippedWork,
  listTasks,
  monthRange,
  prefillFromSource,
  type TaskDraft,
} from "@/lib/tasks";
import { PageHeader } from "@/components/ui";
import { WorkClient } from "@/components/app/work/work-client";
import type { WorkLogMonth } from "@/components/app/work/work-log";

export const metadata = { title: "Work" };

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length <= 64 ? s : undefined;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function WorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { session, project } = await requireAppProject(id);
  const internal = canSeeInternal(session);
  const canEdit = canEditTasks(session);

  const now = new Date();
  const thisMonth = monthRange(now, 0);
  const lastMonth = monthRange(now, -1);

  const [tasks, assignees, shipped] = await Promise.all([
    listTasks(session, project.id),
    canEdit ? listAssignees(session) : Promise.resolve([]),
    listShippedWork(project.id, session.organizationId, lastMonth.from, thisMonth.to, { clientVisibleOnly: !internal }),
  ]);

  const toView = (from: Date, to: Date, label: string): WorkLogMonth => ({
    label,
    items: shipped
      .filter((s) => s.completedAt >= from && s.completedAt < to)
      .map((s) => ({ ...s, completedAt: s.completedAt.toISOString() })),
  });
  const months: [WorkLogMonth, WorkLogMonth] = [
    toView(thisMonth.from, thisMonth.to, monthLabel(thisMonth.from)),
    toView(lastMonth.from, lastMonth.to, monthLabel(lastMonth.from)),
  ];

  // ?fromFinding= / ?fromAction= open the create dialog prefilled from that finding or action.
  let prefill: TaskDraft | null = null;
  let prefillError: string | null = null;
  const fromFinding = one(sp.fromFinding);
  const fromAction = one(sp.fromAction);
  if (canEdit && (fromFinding || fromAction)) {
    try {
      prefill = await prefillFromSource(session, project.id, fromFinding ? { findingId: fromFinding } : { actionId: fromAction });
    } catch (e) {
      prefillError =
        e instanceof HttpError && e.status === 404
          ? `We couldn't find that ${fromFinding ? "audit finding" : "recommended change"} in this project. You can still add a task by hand.`
          : "Something went wrong loading the details. You can still add a task by hand.";
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Work"
        title="Work on your site"
        description="Everything planned, in progress and shipped for this website, plus a log of what was delivered each month."
      />
      <WorkClient
        projectId={project.id}
        initialTasks={tasks}
        assignees={assignees}
        months={months}
        perms={{ canEdit, canSeeInternal: internal, canDelete: canDeleteTasks(session), staffMode: !!session.staffMode }}
        currentUserId={session.userId}
        prefill={prefill}
        prefillError={prefillError}
      />
    </>
  );
}
