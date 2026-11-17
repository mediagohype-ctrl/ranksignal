import { FixHelp } from "@/components/app/fix/fix-help";
import { issueHref } from "@/components/app/nav";

export const metadata = { title: "How to fix" };

const reportHelpHref = (projectId: string, issueId: string) => `${issueHref(projectId, issueId)}/fix`;

// Step 2 of a problem, opened from the Full report: how to fix it on the platform the site is built with (the same
// help as /todo/[itemId]/help, which To-do links to so the menu stays on To-do).
export default async function FixPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; issueId: string }>;
  searchParams: Promise<{ platform?: string }>;
}) {
  const [{ id, issueId }, sp] = await Promise.all([params, searchParams]);
  return <FixHelp projectId={id} issueId={decodeURIComponent(issueId)} platform={sp.platform} helpHref={reportHelpHref} />;
}
