// Full search results across organizations, users, projects and leads.
import Link from "next/link";
import { Search } from "lucide-react";
import { requireStaffPage } from "@/lib/admin/guard";
import { adminSearch, type SearchHit } from "@/lib/admin/search";
import { str, type SearchParams } from "@/lib/admin/params";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { FilterBar, FilterInput } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

const SECTIONS: { type: SearchHit["type"]; title: string }[] = [
  { type: "org", title: "Customers" },
  { type: "user", title: "Users" },
  { type: "project", title: "Projects" },
  { type: "lead", title: "Leads" },
];

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const q = str(sp, "q");
  const hits = await adminSearch(q, 25);
  return (
    <div className="space-y-6">
      <PageHeader className="mb-0" title="Search" description={q ? `Results for “${q}”` : "Search by name, email, domain or id."} />
      <Card>
        <FilterBar action="/admin/search">
          <FilterInput name="q" label="Search" defaultValue={q} placeholder="acme.com, priya@…, cl…" type="search" />
        </FilterBar>
      </Card>
      {q.trim().length < 2 ? null : hits.length === 0 ? (
        <EmptyState icon={<Search />} bordered title="No matches" description="Try part of an email address, a domain or an id." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {SECTIONS.map((s) => {
            const items = hits.filter((h) => h.type === s.type);
            if (!items.length) return null;
            return (
              <Card key={s.type}>
                <CardHeader title={s.title} description={`${items.length} match${items.length === 1 ? "" : "es"}`} />
                <ul className="divide-y divide-border">
                  {items.map((h) => (
                    <li key={h.id}>
                      <Link href={h.href} className="block px-5 py-3 hover:bg-surface-2 sm:px-6">
                        <div className="truncate text-small font-medium text-fg">{h.title}</div>
                        <div className="truncate text-xs text-muted">{h.subtitle}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
