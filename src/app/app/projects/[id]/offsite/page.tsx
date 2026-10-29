import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { getOffsiteSuggestions, listOffsite } from "@/lib/offsite";
import { PageHeader } from "@/components/ui";
import { OffsiteClient, type OffsiteSuggestionsView } from "@/components/app/offsite/offsite-client";

export const metadata = { title: "Off-site" };

export default async function OffsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const [items, suggestions] = await Promise.all([
    listOffsite(session, project.id),
    getOffsiteSuggestions(session, project.id).catch((e): OffsiteSuggestionsView | null => {
      console.error("[offsite] suggestions failed:", e instanceof Error ? e.message : e);
      return null;
    }),
  ]);
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Projects", href: "/app" }, { label: project.name, href: `/app/projects/${project.id}` }, { label: "Off-site" }]}
        eyebrow="Off-site"
        title="Off-site work"
        description="Directory listings, review profiles, press mentions, forum threads and company profiles — the places outside your website that AI assistants read about you."
      />
      <OffsiteClient projectId={project.id} initialItems={items} suggestions={suggestions} canEdit={hasRole(session, "member")} />
    </>
  );
}
