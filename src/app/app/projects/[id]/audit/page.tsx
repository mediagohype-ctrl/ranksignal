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
  redirect(todoHref(id, legacyTodoTarget("audit", sp)));
}
