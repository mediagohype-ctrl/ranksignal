// Image uploads for the blog editor, stored in Cloudflare R2 (S3-compatible) and served from R2_PUBLIC_URL.
// Settings (server .env only, never in git): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
// R2_PUBLIC_URL (the bucket's public r2.dev address or a custom domain like https://media.mywebrank.tech) and
// R2_UPLOAD_PREFIX (folder inside the bucket, default "uploads").
import { randomBytes } from "node:crypto";
import { request } from "node:https";
import { AwsV4Signer } from "aws4fetch";

type Env = Record<string, string | undefined>;

export function r2Config(env: Env = process.env) {
  const accountId = env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = env.R2_BUCKET_NAME?.trim() ?? "";
  const publicUrl = (env.R2_PUBLIC_URL?.trim() ?? "").replace(/\/+$/, "");
  const prefix = (env.R2_UPLOAD_PREFIX?.trim() || "uploads").replace(/^\/+|\/+$/g, "");
  const ok = Boolean(accountId && accessKeyId && secretAccessKey && bucket && /^https:\/\//.test(publicUrl));
  return { ok, accountId, accessKeyId, secretAccessKey, bucket, publicUrl, prefix };
}

export const isR2Configured = (env: Env = process.env) => r2Config(env).ok;

/** Images we accept, by their first bytes (the browser's file type and name are never trusted). No SVG: it can carry scripts. */
const SIGNATURES: { type: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/gif", ext: "gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  { type: "image/webp", ext: "webp", test: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP" },
  { type: "image/avif", ext: "avif", test: (b) => ascii(b, 4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(b, 8, 12)) },
];
function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.slice(from, to));
}

/** The image type from the file's first bytes, or null when it isn't a supported image. */
export function sniffImage(bytes: Uint8Array): { type: string; ext: string } | null {
  const s = SIGNATURES.find((x) => x.test(bytes));
  return s ? { type: s.type, ext: s.ext } : null;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** "uploads/blog/2026/11/a1b2c3d4-best-cake-shop.webp": dated folder, random part (no overwrites), readable name for SEO. */
export function imageKey(prefix: string, fileName: string, ext: string, now = new Date(), random = randomBytes(4).toString("hex")): string {
  const base =
    fileName
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image";
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/blog/${y}/${m}/${random}-${base}.${ext}`;
}

/**
 * Upload one object; resolves to its public URL. Throws on any R2 error (the caller shows a friendly message).
 *
 * Signed with aws4fetch, then sent with Node's own https client and an exact Content-Length: inside Next.js the
 * global fetch is wrapped and sent the body as a stream without a length, which R2 refuses ("MissingContentLength").
 */
export async function putObject(key: string, body: Uint8Array, contentType: string, env: Env = process.env): Promise<string> {
  const c = r2Config(env);
  if (!c.ok) throw new Error("R2 is not configured");
  const url = `https://${c.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(c.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const bytes = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  const signed = await new AwsV4Signer({
    url,
    method: "PUT",
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    service: "s3",
    region: "auto",
  }).sign();
  const headers: Record<string, string> = { "Content-Length": String(bytes.byteLength) };
  signed.headers.forEach((v, k) => {
    headers[k] = v;
  });
  const { status, text } = await httpsPut(signed.url.toString(), headers, bytes);
  if (status < 200 || status >= 300) {
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] ?? `HTTP ${status}`;
    throw new Error(`R2 upload failed: ${code}`);
  }
  return `${c.publicUrl}/${key}`;
}

function httpsPut(url: string, headers: Record<string, string>, body: Buffer): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "PUT", headers, timeout: 30_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("R2 upload timed out")));
    req.on("error", reject);
    req.end(body);
  });
}
