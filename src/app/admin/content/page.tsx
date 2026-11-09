// Blog & content: every post with status, content score and quick links. Writers see drafts; publishers ship.
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/admin/guard";
import { faqsOf, POST_STATUSES } from "@/lib/content/posts";
import { scorePost } from "@/lib/content/score";
import { ARTICLES } from "@/lib/learn/articles";
import { fmtAgo, fmtDate, oneOf, type SearchParams } from "@/lib/admin/params";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Stat, Table, TD, TH, THead, TR, type Tone } from "@/components/ui";
import { LinkTabs } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog & content" };

const STATUS_TONE: Record<string, Tone> = { draft: "neutral", review: "warning", published: "success", archived: "neutral" };
const scoreTone = (s: number): Tone => (s >= 75 ? "success" : s >= 50 ? "warning" : "danger");

export default async function ContentList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaffPage("content.view");
  const sp = await searchParams;
  const status = oneOf(sp, "status", ["all", ...POST_STATUSES] as const, "all");
  const posts = await db.blogPost.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  const counts = await db.blogPost.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const rows = posts.map((p) => ({ p, score: scorePost({ ...p, faqs: faqsOf(p) }) }));
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.score.overall, 0) / rows.length) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blog & content"
        description="Write, score and publish posts for mywebrank.tech/blog. Published posts go into the sitemap, llms.txt and RSS automatically."
        actions={
          staff.can("content.write") ? (
            <LinkButton href="/admin/content/new" icon={<Plus />}>
              New post
            </LinkButton>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Published" value={count("published")} />
        <Stat label="Waiting for review" value={count("review")} />
        <Stat label="Drafts" value={count("draft")} />
        <Stat label="Avg content score" value={avg ?? "—"} hint="This list" />
        <Stat label="Evergreen guides" value={ARTICLES.length} hint="/learn (in code)" />
      </div>
      <LinkTabs
        label="Filter by status"
        basePath="/admin/content"
        param="status"
        sp={{}}
        active={status}
        tabs={[
          { id: "all", label: "All" },
          { id: "review", label: "Review", count: count("review") },
          { id: "draft", label: "Drafts", count: count("draft") },
          { id: "published", label: "Published", count: count("published") },
          { id: "archived", label: "Archived", count: count("archived") },
        ]}
      />
      <Card>
        <CardHeader title={`Posts (${rows.length})`} />
        {rows.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Start with the questions buyers ask: “best SEO company in [city]”, “how to rank in ChatGPT”, “SEO audit cost in India”."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table caption="Blog posts" density="compact" zebra>
              <THead>
                <TR>
                  <TH>Post</TH>
                  <TH>Status</TH>
                  <TH align="center">Score</TH>
                  <TH align="center">SEO · AEO · GEO</TH>
                  <TH align="right">Words</TH>
                  <TH>Main phrase</TH>
                  <TH>Updated</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map(({ p, score }) => (
                  <TR key={p.id}>
                    <TD>
                      <Link href={`/admin/content/${p.id}`} className="font-medium text-fg hover:underline">
                        {p.title}
                      </Link>
                      <span className="block text-xs text-muted">
                        /blog/{p.slug} · {p.category} · {p.authorName}
                        {p.publishedAt ? ` · published ${fmtDate(p.publishedAt)}` : ""}
                      </span>
                    </TD>
                    <TD>
                      <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{p.status}</Badge>
                      {p.noindex && (
                        <Badge tone="warning" className="ml-1">
                          noindex
                        </Badge>
                      )}
                    </TD>
                    <TD align="center">
                      <Badge tone={scoreTone(score.overall)}>{score.overall}</Badge>
                    </TD>
                    <TD align="center" className="whitespace-nowrap text-xs">
                      {score.pillars.seo} · {score.pillars.aeo} · {score.pillars.geo}
                    </TD>
                    <TD align="right">{score.stats.words.toLocaleString("en-IN")}</TD>
                    <TD className="text-xs">{p.keywords[0] ?? <span className="text-danger">none</span>}</TD>
                    <TD>{fmtAgo(p.updatedAt)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
