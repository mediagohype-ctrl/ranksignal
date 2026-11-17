// To-do → "Outside your website" when nothing is on the list yet: instead of an empty tab, show the starter
// listings for this kind of business (India), each leading to "Your listings" where it can be added in one click.
import { ArrowRight, Globe2 } from "lucide-react";
import { db } from "@/lib/db";
import { projectBusinessKind, starterSuggestions, BUSINESS_KIND_LABEL } from "@/lib/offsite";
import { LinkButton } from "@/components/ui";

export async function StarterListingsPreview({
  project,
  listingsHref,
}: {
  project: { id: string; organizationId: string; categories?: unknown; keywords?: unknown; audience?: string | null; facts?: unknown };
  listingsHref: string;
}) {
  const [kind, tracked] = await Promise.all([
    projectBusinessKind(project),
    db.offsiteItem.findMany({ where: { organizationId: project.organizationId, projectId: project.id }, select: { url: true, name: true }, take: 500 }),
  ]);
  const todo = starterSuggestions(tracked, kind).filter((s) => !s.tracked).slice(0, 5);
  if (todo.length === 0) {
    return (
      <div className="space-y-3 p-5 text-center sm:p-6">
        <p className="text-small font-medium text-fg">Nothing to do outside your website right now.</p>
        <LinkButton href={listingsHref} variant="secondary" size="sm">
          See your listings
        </LinkButton>
      </div>
    );
  }
  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden>
          <Globe2 size={18} />
        </span>
        <div>
          <h2 className="text-small font-semibold text-fg">Start with these {todo.length === 1 ? "listing" : `${todo.length} listings`}</h2>
          <p className="mt-0.5 text-small text-muted">
            Common places customers and AI tools look up {BUSINESS_KIND_LABEL[kind]}. Being listed doesn&apos;t guarantee AI will name you, but
            these are the places it reads.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {todo.map((s) => (
          <li key={s.key} className="px-4 py-3">
            <p className="text-small font-medium text-fg">{s.name}</p>
            <p className="mt-0.5 text-xs text-muted">{s.note}</p>
          </li>
        ))}
      </ul>
      <LinkButton href={listingsHref} size="sm" iconRight={<ArrowRight />}>
        Add these to your listings
      </LinkButton>
    </div>
  );
}
