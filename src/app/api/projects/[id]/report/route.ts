import { handler, json, requireProject, requireSession } from "@/lib/api";
import { buildSiteReport } from "@/lib/report/build";
import { reportToMarkdown } from "@/lib/report/markdown";

export const dynamic = "force-dynamic";

/** GET /api/projects/[id]/report → { item: SiteReport }; ?format=markdown → downloadable .md file. */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  const item = await buildSiteReport(project.id, s.organizationId);

  const format = new URL(req.url).searchParams.get("format");
  if (format === "markdown" || format === "md") {
    const slug = (project.name || "website").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "website";
    return new Response(reportToMarkdown(item), {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-report-${item.generatedAt.slice(0, 10)}.md"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return json({ item }, { headers: { "Cache-Control": "no-store" } });
});
