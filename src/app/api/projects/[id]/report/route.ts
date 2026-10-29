import { HttpError, handler, json, requireProject, requireSession } from "@/lib/api";
import { getStoredReport } from "@/lib/report/stored";
import { reportToMarkdown } from "@/lib/report/markdown";

export const dynamic = "force-dynamic";

/** GET /api/projects/[id]/report → { item: SiteReport }; ?format=markdown → downloadable .md file. */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  // Stored report: GET never triggers a paid LLM call (the summary is generated once when a run finishes).
  const item = await getStoredReport(project.id, s.organizationId);
  if (!item) throw new HttpError(404, "not_found", "Report not available");

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
