// Shrinks an image in the browser before it is uploaded (blog editor): phone photos are often 5–12 MB, over the
// 5 MB upload limit and far heavier than a web page needs. Large images are scaled to at most MAX_SIDE pixels on the
// longest side and saved as WebP. Small images, GIFs (may be animated) and anything the browser can't decode are
// uploaded unchanged. Never throws: on any problem the original file is returned.

const MAX_SIDE = 1920;
const QUALITY = 0.82;
/** Files at or under this size, and already small enough in pixels, are left as they are. */
const SMALL_BYTES = 600 * 1024;

export async function shrinkImage(file: File): Promise<File> {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // a format this browser can't decode: let the server check it
  }
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (file.size <= SMALL_BYTES && longest <= MAX_SIDE) return file;
    const scale = Math.min(1, MAX_SIDE / longest);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
    // Some browsers can't write WebP and fall back to PNG; keep whichever is smaller.
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
    const name = `${file.name.replace(/\.[a-z0-9]{2,5}$/i, "") || "image"}.${ext}`;
    return new File([blob], name, { type: blob.type });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
