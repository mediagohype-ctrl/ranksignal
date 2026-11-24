// POST /api/admin/uploads — staff with content.write upload one image (multipart field "file") for a blog post.
// Checked by its real bytes (JPG, PNG, WebP, GIF, AVIF; never SVG), at most 5 MB, stored in Cloudflare R2 under a
// dated, non-guessable name. Returns { item: { url, key, type, bytes } }. Same-origin only (middleware CSRF check).
import { handler, HttpError, json } from "@/lib/api";
import { requireStaffApi } from "@/lib/admin/guard";
import { MAX_IMAGE_BYTES, imageKey, isR2Configured, putObject, r2Config, sniffImage } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  await requireStaffApi("content.write");
  if (!isR2Configured()) {
    throw new HttpError(503, "uploads_off", "Image uploads aren't set up yet. Add the R2 settings on the server, or paste an image address instead.");
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "no_file", "Choose an image to upload.");
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, "too_big", "That image is over 5 MB. Make it smaller (for example 1600 px wide, WebP or JPG) and try again.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw new HttpError(415, "not_image", "Upload a JPG, PNG, WebP, GIF or AVIF image.");

  const key = imageKey(r2Config().prefix, file.name || "image", kind.ext);
  try {
    const url = await putObject(key, bytes, kind.type);
    return json({ item: { url, key, type: kind.type, bytes: bytes.byteLength } }, { status: 201 });
  } catch (e) {
    console.warn("[uploads]", (e as Error)?.message ?? "error");
    throw new HttpError(502, "upload_failed", "We couldn't save the image right now. Please try again in a minute.");
  }
});
