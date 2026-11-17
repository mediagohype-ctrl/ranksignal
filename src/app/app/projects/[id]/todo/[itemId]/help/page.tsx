import { FixHelp } from "@/components/app/fix/fix-help";
import { todoHelpHref } from "@/components/app/nav";

export const metadata = { title: "How to fix" };

// Step-by-step help for a To-do item. Lives under /todo so the menu keeps "To-do" highlighted while fixing
// (audit bug 11); the Full report opens the same help at /report/issues/[issueId]/fix.
export default async function TodoHelpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ platform?: string }>;
}) {
  const [{ id, itemId }, sp] = await Promise.all([params, searchParams]);
  return <FixHelp projectId={id} issueId={decodeURIComponent(itemId)} platform={sp.platform} helpHref={todoHelpHref} />;
}
