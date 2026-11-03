import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { getOffsiteSuggestions, listOffsite } from "@/lib/offsite";
import { PageHeader } from "@/components/ui";
import { OffsiteClient, type OffsiteSuggestionsView } from "@/components/app/offsite/offsite-client";

export const metadata = { title: "Outside your website" };

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
        breadcrumbs={[{ label: "Projects", href: "/app" }, { label: project.name, href: `/app/projects/${project.id}` }, { label: "Outside your website" }]}
        eyebrow="To-do"
        title="Outside your website"
        description="Listings, reviews and articles about you on other sites. AI tools read these too."
      />
      <OffsiteClient projectId={project.id} initialItems={items} suggestions={suggestions} canEdit={hasRole(session, "member")} />
    </>
  );
}
