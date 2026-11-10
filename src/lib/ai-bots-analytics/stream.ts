// Streaming line reader for uploaded logs: enforces the upload cap on the bytes received, transparently gunzips
// (.gz detected by magic bytes), caps the decompressed size (zip-bomb guard) and hashes the raw upload so the same
// file can't be counted twice. Nothing is buffered beyond the current chunk + one partial line.
import { createHash } from "node:crypto";
import { pipeline, Readable } from "node:stream";
import zlib from "node:zlib";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
/** Decompressed cap for .gz uploads (access logs compress ~10–20×). */
export const MAX_DECOMPRESSED_BYTES = 1024 * 1024 * 1024;
const MAX_LINE_CHARS = 16 * 1024;

export class UploadLimitError extends Error {
  constructor(
    public code: "too_large" | "too_large_decompressed" | "bad_gzip",
    message: string,
  ) {
    super(message);
  }
}

export interface StreamStats {
  bytes: number;
  sha256: string;
  gzip: boolean;
}

/**
 * Iterate the lines of an upload. `stats` is filled in as the stream is consumed (final once iteration ends).
 * Over-long lines are skipped (yielded as "").
 */
export async function* readLogLines(
  source: AsyncIterable<Uint8Array>,
  stats: StreamStats,
  opts: { maxBytes?: number; maxDecompressedBytes?: number } = {},
): AsyncGenerator<string> {
  const maxBytes = opts.maxBytes ?? MAX_UPLOAD_BYTES;
  const maxOut = opts.maxDecompressedBytes ?? MAX_DECOMPRESSED_BYTES;
  const hash = createHash("sha256");
  stats.bytes = 0;
  stats.gzip = false;

  const iterator = source[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) {
    stats.sha256 = hash.digest("hex");
    return;
  }
  const head = first.value;
  stats.gzip = head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;

  async function* raw(): AsyncGenerator<Uint8Array> {
    let chunk: Uint8Array | undefined = head;
    while (chunk) {
      stats.bytes += chunk.length;
      if (stats.bytes > maxBytes) throw new UploadLimitError("too_large", `The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      hash.update(chunk);
      yield chunk;
      const n = await iterator.next();
      chunk = n.done ? undefined : n.value;
    }
  }

  let decoded: AsyncIterable<Uint8Array> = raw();
  if (stats.gzip) {
    const gunzip = zlib.createGunzip();
    // pipeline() destroys gunzip with any upstream error (e.g. the size cap), so the loop below sees it.
    pipeline(Readable.from(raw()), gunzip, () => undefined);
    decoded = gunzip as unknown as AsyncIterable<Uint8Array>;
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  let out = 0;
  let pending = "";
  try {
    for await (const chunk of decoded) {
      out += chunk.length;
      if (out > maxOut) throw new UploadLimitError("too_large_decompressed", "The unzipped log is too large. Upload a shorter period.");
      pending += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, nl);
        pending = pending.slice(nl + 1);
        yield line.length > MAX_LINE_CHARS ? "" : line.replace(/\r$/, "");
      }
      if (pending.length > MAX_LINE_CHARS * 4) pending = ""; // a binary file or one giant line: drop it
    }
  } catch (e) {
    if (e instanceof UploadLimitError) throw e;
    if (stats.gzip && e && typeof e === "object" && "code" in e && String((e as { code: unknown }).code).startsWith("Z_")) {
      throw new UploadLimitError("bad_gzip", "The .gz file looks damaged. Try uploading it again or unzip it first.");
    }
    throw e;
  }
  pending += decoder.decode();
  if (pending) yield pending.length > MAX_LINE_CHARS ? "" : pending.replace(/\r$/, "");
  stats.sha256 = hash.digest("hex");
}
