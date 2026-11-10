// POST raw log file bytes (.log or .gz, max 50 MB) as the request body; file name in x-file-name. Members and up.
// The body is parsed as a stream; only daily per-bot aggregates are kept.
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { handler, HttpError, json, requireProject, requireSession } from "@/lib/api";
import { writeAuditLog, auditActorFromSession } from "@/lib/audit-log";
import { AiBotLimitError, DuplicateImportError, importLogUpload, UploadLimitError } from "@/lib/ai-bots-analytics/service";
import { MAX_UPLOAD_BYTES } from "@/lib/ai-bots-analytics/stream";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) throw new HttpError(413, "too_large", "The file is larger than 50 MB. Upload a shorter period, or gzip it first.");
  if (!req.body) throw new HttpError(400, "empty", "Choose a log file to upload.");
  const rawName = req.headers.get("x-file-name");
  const fileName = rawName ? decodeURIComponent(rawName).replace(/[^\w.\- ]/g, "").slice(0, 200) || null : null;

  try {
    const result = await importLogUpload({
      organizationId: s.organizationId,
      projectId: project.id,
      userId: s.userId,
      fileName,
      body: Readable.fromWeb(req.body as unknown as NodeWebStream<Uint8Array>),
    });
    await writeAuditLog({
      organizationId: s.organizationId, ...auditActorFromSession(s), action: "ai_bots.log_uploaded",
      resourceType: "project", resourceId: project.id,
      after: { importId: result.importId, botHits: result.botHits, linesTotal: result.linesTotal, bytes: result.bytes },
    });
    return json({ item: result });
  } catch (e) {
    if (e instanceof UploadLimitError) throw new HttpError(e.code === "bad_gzip" ? 400 : 413, e.code, e.message);
    if (e instanceof DuplicateImportError) throw new HttpError(409, "duplicate_file", e.message);
    if (e instanceof AiBotLimitError) throw new HttpError(429, "upload_limit", e.message);
    throw e;
  }
});
