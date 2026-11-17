// POST {statement, verdict: "correct" | "wrong", engine?, correction?} — the owner's answer to one statement under
// "Check these facts" (AI answers page). Member+.
//   correct → remembered on Project.settings.confirmedFacts: not asked again, and later brand checks treat it as true.
//   wrong   → remembered on Project.settings.rejectedFacts AND a To-do task is created to get it corrected; the
//             response says where the task is ({ task: { id, href } }) so the page can link to it.
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { createTask } from "@/lib/tasks";
import { todoHref } from "@/lib/tasks/todo";
import { productNames } from "@/lib/report/checks/geo";
import {
  CONFIRMED_FACTS_KEY, REJECTED_FACTS_KEY, readFactReviews, rejectedFact, withConfirmedFact, withRejectedFact, wrongFactTaskDescription,
  wrongFactTaskTitle,
} from "@/lib/visibility/fact-review";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  statement: z.string().trim().min(1).max(400),
  verdict: z.enum(["correct", "wrong"]),
  engine: z.string().trim().max(200).optional(),
  correction: z.string().trim().max(300).optional(),
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, bodySchema);
  const settings = project.settings && typeof project.settings === "object" && !Array.isArray(project.settings) ? (project.settings as Record<string, unknown>) : {};
  const reviews = readFactReviews(settings);

  let task: { id: string; href: string } | null = null;
  let next = reviews;
  if (body.verdict === "correct") {
    next = withConfirmedFact(reviews, body.statement);
  } else {
    // Pressed twice (or said again by a later check): reuse the task that is already on the list.
    const earlier = rejectedFact(reviews, body.statement);
    const existing = earlier?.taskId
      ? await db.task.findFirst({ where: { id: earlier.taskId, organizationId: s.organizationId, projectId: project.id }, select: { id: true } })
      : null;
    const taskId =
      existing?.id ??
      (
        await createTask(s, project.id, {
          title: wrongFactTaskTitle(body.statement),
          description: wrongFactTaskDescription({
            statement: body.statement,
            toolName: body.engine ? productNames([body.engine]) : undefined,
            correction: body.correction,
          }),
          // "content" (not "offsite"): the task shows on the To-do list's first tab, "On your website", where people look.
          category: "content",
          performedBy: "client",
          priority: "high",
        })
      ).id;
    next = withRejectedFact(reviews, { statement: body.statement, correction: body.correction ?? earlier?.correction, taskId });
    task = { id: taskId, href: todoHref(project.id, { item: `task-${taskId}` }) };
  }

  await db.project.update({
    where: { id: project.id },
    data: { settings: { ...settings, [CONFIRMED_FACTS_KEY]: next.confirmed, [REJECTED_FACTS_KEY]: next.rejected } as unknown as Prisma.InputJsonValue },
  });
  return json({ item: { verdict: body.verdict, task } }, { status: 201 });
});
