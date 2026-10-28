// GET /api/projects/[id]/monthly-reports/[period] → { item: { ...listItem, summary, payload } };
// ?format=markdown → downloadable .md file.
import { HttpError, handler, json, requireProject, requireSession } from "@/lib/api";
import { isValidPeriod } from "@/lib/monthly-report/period";
import { monthlyReportToMarkdown } from "@/lib/monthly-report/markdown";
import { getProjectReport, markdownFilename, payloadOf, toListItem } from "@/lib/monthly-report/server";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string; period: string }> }) => {
  const s = await requireSession("viewer");
  const { id, period } = await params;
  if (!isValidPeriod(period)) throw new HttpError(400, "invalid_period", "Period must look like YYYY-MM");
  const project = await requireProject(s, id);
  const report = await getProjectReport(s, project.id, period);
  const payload = report ? payloadOf(report) : null;
  if (!report || !payload) throw new HttpError(404, "not_found", "Report not found");

  const format = new URL(req.url).searchParams.get("format");
  if (format === "markdown" || format === "md") {
    return new Response(monthlyReportToMarkdown(payload, report.summary ?? ""), {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${markdownFilename(payload)}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return json({ item: { ...toListItem(report), summary: report.summary, payload } }, { headers: { "Cache-Control": "no-store" } });
});
