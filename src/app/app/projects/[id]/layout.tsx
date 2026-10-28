import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { requireAppProject } from "@/lib/dashboard/server";
import { hostOf } from "@/lib/dashboard/format";
import { Avatar } from "@/components/ui";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project } = await requireAppProject(id);
  return (
    <div>
      <nav aria-label="Project" className="no-print mb-5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
        <Link href="/app" className="rounded hover:text-fg hover:underline underline-offset-4">
          Projects
        </Link>
        <ChevronRight size={14} aria-hidden className="opacity-60" />
        <Link
          href={`/app/projects/${project.id}`}
          className="flex min-w-0 items-center gap-2 rounded font-medium text-fg hover:underline underline-offset-4"
        >
          <Avatar name={project.name} size="xs" className="ring-0" />
          <span className="truncate">{project.name}</span>
        </Link>
        <a
          href={project.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs hover:border-border-strong hover:text-fg"
        >
          <span className="truncate">{hostOf(project.websiteUrl)}</span>
          <ExternalLink size={11} aria-hidden className="shrink-0" />
          <span className="sr-only">(opens in new tab)</span>
        </a>
      </nav>
      {children}
    </div>
  );
}
