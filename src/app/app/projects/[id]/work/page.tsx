import { redirect } from "next/navigation";
import { legacyTodoTarget, todoHref } from "@/lib/tasks/todo";

// This page is now part of the one To-do list (Developer Brief v1). Old links and bookmarks land there.
export default async function LegacyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // "Add a task from this problem" links keep their prefilled form on the task board.
  const finding = Array.isArray(sp.fromFinding) ? sp.fromFinding[0] : sp.fromFinding;
  if (finding && /^[A-Za-z0-9_-]{1,64}$/.test(finding)) redirect(`${todoHref(id)}/board?fromFinding=${finding}`);
  redirect(todoHref(id, legacyTodoTarget("work", sp)));
}
