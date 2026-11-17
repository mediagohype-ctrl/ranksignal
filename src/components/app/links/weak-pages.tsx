import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { TEST_PAGE_NOTE, type WeakPage } from "@/lib/links/suggest";
import { Badge, EmptyState } from "@/components/ui";

const SHOW = 50;

function pathOf(u: string): string {
  try {
    const x = new URL(u);
    return `${x.pathname}${x.search}` || "/";
  } catch {
    return u;
  }
}

/** Orphan / weakly linked pages, with a jump to their suggestions. */
export function WeakPagesList({ projectId, pages }: { projectId: string; pages: WeakPage[] }) {
  if (!pages.length) {
    return <EmptyState size="sm" picture="done" title="Every page we checked has at least 2 links from your other pages." />;
  }
  const shown = pages.slice(0, SHOW);
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border">
        {shown.map((p) => (
          <li key={p.url} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
            <div className="min-w-0 flex-1">
              {/* Address first: many pages can share one title, the address tells them apart. */}
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 font-medium text-fg hover:underline"
              >
                <span className="truncate">{pathOf(p.url)}</span>
                <ExternalLink size={11} aria-hidden className="shrink-0 text-muted" />
                <span className="sr-only">(opens in new tab)</span>
              </a>
              <p className="truncate text-xs text-muted">{p.label}</p>
              {p.testPage && <p className="mt-0.5 text-xs font-medium text-warning">{TEST_PAGE_NOTE}</p>}
            </div>
            <Badge tone={p.strength === "orphan" ? "danger" : "warning"}>
              {p.strength === "orphan" ? "No links in" : "1 link in"}
            </Badge>
            {p.suggestionCount > 0 ? (
              <Link
                href={`/app/projects/${projectId}/links?target=${encodeURIComponent(p.url)}`}
                className="text-small font-medium text-primary hover:underline"
              >
                {p.suggestionCount} suggested link{p.suggestionCount === 1 ? "" : "s"}
              </Link>
            ) : (
              <span className="text-small text-muted">Link it from your menu or a related page</span>
            )}
          </li>
        ))}
      </ul>
      {pages.length > SHOW && <p className="text-small text-muted">And {pages.length - SHOW} more pages with 0–1 links in.</p>}
    </div>
  );
}
