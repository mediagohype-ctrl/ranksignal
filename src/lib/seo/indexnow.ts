// IndexNow submission (Bing, Yandex, Seznam, Naver). Shared by `npm run indexnow` and the admin SEO centre.
import { publicUrls, siteBase } from "@/lib/free-check/site-seo";

export const INDEXNOW_KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

export function indexNowKey(): string | null {
  const key = (process.env.INDEXNOW_KEY ?? "").trim();
  return INDEXNOW_KEY_RE.test(key) ? key : null;
}

export interface IndexNowResult {
  ok: boolean;
  status: number;
  submitted: number;
  message: string;
}

/** Submits `paths` (default: every public marketing URL). Throws only on misconfiguration. */
export async function submitIndexNow(
  opts: { paths?: string[]; appUrl?: string; fetchImpl?: typeof fetch; extraPaths?: string[] } = {},
): Promise<IndexNowResult> {
  const key = indexNowKey();
  if (!key) throw new Error("Set INDEXNOW_KEY (8–128 letters, digits or dashes).");
  const base = siteBase(opts.appUrl ?? process.env.APP_URL);
  if (!/^https:\/\//.test(base) || base.includes("localhost")) throw new Error(`APP_URL must be the public https URL (got ${base}).`);
  const paths = (opts.paths ?? []).filter((p) => p.startsWith("/"));
  const urlList = paths.length
    ? paths.map((p) => `${base}${p}`)
    : [...publicUrls(base), ...(opts.extraPaths ?? []).filter((p) => p.startsWith("/")).map((p) => `${base}${p}`)];

  const res = await (opts.fetchImpl ?? fetch)("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(base).host, key, keyLocation: `${base}/indexnow.txt`, urlList }),
  });
  // 200/202 = accepted. 403 = key file not reachable or mismatched. 422 = URLs not on this host.
  const ok = res.status === 200 || res.status === 202;
  const message = ok
    ? `Accepted ${urlList.length} URL(s).`
    : res.status === 403
      ? "Key not verified: check that /indexnow.txt is reachable on the live site and matches INDEXNOW_KEY."
      : `IndexNow answered HTTP ${res.status}.`;
  return { ok, status: res.status, submitted: urlList.length, message };
}
