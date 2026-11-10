// IndexNow for customers' sites: per-project key, key-file verification (SSRF-safe GET), queueing changed URLs and
// the hooks called after a fix is published or a crawl finds changed pages. Hooks never throw.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { log } from "@/lib/log";
import { safeFetch, SafeFetchError } from "@/lib/crawler/safe-fetch";
import { changedPages, filterUrlsForHost, generateIndexNowKey, keyFileMatches, keyFileUrl, siteOf, type PageVersion } from "./core";

export type IndexNowTrigger = "fix_published" | "crawl_changes" | "manual";

/** The project's IndexNow row, created (with a fresh key, not yet enabled) on first use. Tenant-scoped. */
export async function getOrCreateIndexNowSite(project: { id: string; organizationId: string; websiteUrl: string }) {
  const existing = await db.indexNowSite.findFirst({ where: { organizationId: project.organizationId, projectId: project.id } });
  const site = siteOf(project.websiteUrl);
  if (!site) throw new Error("invalid_website_url");
  if (existing) {
    // Website address changed: the old verification no longer applies.
    if (existing.host !== site.host) {
      return db.indexNowSite.update({ where: { id: existing.id }, data: { host: site.host, status: "pending", enabled: false, verifiedAt: null } });
    }
    return existing;
  }
  try {
    return await db.indexNowSite.create({ data: { organizationId: project.organizationId, projectId: project.id, host: site.host, key: generateIndexNowKey() } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return db.indexNowSite.findFirstOrThrow({ where: { organizationId: project.organizationId, projectId: project.id } });
    }
    throw e;
  }
}

export interface VerifyResult {
  ok: boolean;
  url: string;
  message: string;
}

/** GET {origin}/{key}.txt through the SSRF-safe fetcher and check the body. Pure of DB; exported for tests. */
export async function checkKeyFile(origin: string, key: string, fetcher: typeof safeFetch = safeFetch): Promise<VerifyResult> {
  const url = keyFileUrl(origin, key);
  try {
    const res = await fetcher(url, { timeoutMs: 10_000, maxBytes: 64 * 1024, maxRedirects: 3 });
    if (res.status === 404) return { ok: false, url, message: `We couldn't find ${url} (404). Upload the file to your site's top folder.` };
    if (res.status < 200 || res.status >= 300) return { ok: false, url, message: `${url} answered HTTP ${res.status}.` };
    // IndexNow requires the key file on the same host; a redirect to another host won't be accepted by search engines.
    if (new URL(res.finalUrl).host.toLowerCase() !== new URL(url).host.toLowerCase()) {
      return { ok: false, url, message: `${url} redirects to another address (${new URL(res.finalUrl).host}). The file must be on ${new URL(url).host}.` };
    }
    if (!keyFileMatches(res.body, key)) return { ok: false, url, message: `${url} was found, but it doesn't contain exactly the key.` };
    return { ok: true, url, message: "Key file found and correct." };
  } catch (e) {
    const msg = e instanceof SafeFetchError ? (e.code === "timeout" ? "timed out" : e.code === "blocked" ? "isn't a public address" : "couldn't be reached") : "couldn't be reached";
    return { ok: false, url, message: `${url} ${msg}.` };
  }
}

/** Verify and (on success) enable IndexNow for the project. */
export async function verifyIndexNowSite(project: { id: string; organizationId: string; websiteUrl: string }) {
  const site = await getOrCreateIndexNowSite(project);
  const origin = siteOf(project.websiteUrl)!.origin;
  const r = await checkKeyFile(origin, site.key);
  const now = new Date();
  const updated = await db.indexNowSite.update({
    where: { id: site.id },
    data: r.ok
      ? { status: "verified", enabled: true, verifiedAt: now, lastCheckAt: now, lastCheckError: null }
      : { status: site.status === "verified" ? "failed" : site.status === "failed" ? "failed" : "pending", enabled: false, lastCheckAt: now, lastCheckError: r.message.slice(0, 500) },
  });
  return { site: updated, result: r };
}

/** Is there already a pending indexnow run for this project? (then it will pick up newly queued URLs). */
async function hasPendingRun(organizationId: string, projectId: string): Promise<boolean> {
  const run = await db.workflowRun.findFirst({
    where: { organizationId, projectId, kind: "indexnow", state: { in: ["queued", "retry_scheduled"] } },
    select: { id: true },
  });
  return !!run;
}

export async function scheduleIndexNowRun(organizationId: string, projectId: string, delayMs = 60_000) {
  if (await hasPendingRun(organizationId, projectId)) return;
  // Short delay so several fixes published together go out as one batch.
  await enqueue({ kind: "indexnow", organizationId, projectId, input: { projectId }, runAfter: new Date(Date.now() + delayMs), maxAttempts: 5 });
}

/**
 * Queue URLs for IndexNow. Returns how many were queued (0 when IndexNow isn't verified/enabled for this project, the
 * trigger is switched off, or none of the URLs are on the site's host).
 */
export async function queueIndexNowUrls(o: { organizationId: string; projectId: string; urls: string[]; trigger: IndexNowTrigger }): Promise<number> {
  const site = await db.indexNowSite.findFirst({ where: { organizationId: o.organizationId, projectId: o.projectId } });
  if (!site || !site.enabled || site.status !== "verified") return 0;
  if (o.trigger === "fix_published" && !site.onFixPublished) return 0;
  if (o.trigger === "crawl_changes" && !site.onCrawlChanges) return 0;
  const urls = filterUrlsForHost(o.urls, site.host);
  if (urls.length === 0) return 0;
  await db.indexNowSubmission.create({
    data: { organizationId: o.organizationId, projectId: o.projectId, host: site.host, trigger: o.trigger, urls: urls as Prisma.InputJsonValue, urlCount: urls.length },
  });
  await scheduleIndexNowRun(o.organizationId, o.projectId);
  return urls.length;
}

/** Hook: an approved fix was published to `url` through a connector. Never throws. */
export async function notifyIndexNowFixPublished(o: { organizationId: string; projectId: string; url: string | null | undefined }): Promise<void> {
  if (!o.url) return;
  try {
    await queueIndexNowUrls({ organizationId: o.organizationId, projectId: o.projectId, urls: [o.url], trigger: "fix_published" });
  } catch (e) {
    log.warn("indexnow.queue_failed", { projectId: o.projectId, err: e instanceof Error ? e.message : String(e) });
  }
}

const fingerprintOf = (extracted: unknown): string | null => {
  const f = extracted && typeof extracted === "object" ? (extracted as { contentFingerprint?: unknown }).contentFingerprint : null;
  return typeof f === "string" && f ? f : null;
};

async function pageVersions(organizationId: string, crawlRunId: string): Promise<PageVersion[]> {
  const pages = await db.crawlPage.findMany({
    where: { organizationId, crawlRunId },
    select: { url: true, finalUrl: true, statusCode: true, contentType: true, extracted: true },
    take: 20_000,
  });
  return pages.map((p) => ({ url: p.finalUrl ?? p.url, statusCode: p.statusCode, contentType: p.contentType, fingerprint: fingerprintOf(p.extracted) }));
}

/** Hook: a crawl finished. Announces pages that are new or changed since the previous successful crawl. Never throws. */
export async function queueIndexNowAfterCrawl(o: { organizationId: string; projectId: string; crawlRunId: string }): Promise<number> {
  try {
    const site = await db.indexNowSite.findFirst({ where: { organizationId: o.organizationId, projectId: o.projectId }, select: { enabled: true, onCrawlChanges: true } });
    if (!site?.enabled || !site.onCrawlChanges) return 0;
    const prev = await db.crawlRun.findFirst({
      where: { organizationId: o.organizationId, projectId: o.projectId, status: "succeeded", id: { not: o.crawlRunId } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!prev) return 0;
    const [before, after] = await Promise.all([pageVersions(o.organizationId, prev.id), pageVersions(o.organizationId, o.crawlRunId)]);
    const urls = changedPages(before, after);
    if (urls.length === 0) return 0;
    return await queueIndexNowUrls({ organizationId: o.organizationId, projectId: o.projectId, urls, trigger: "crawl_changes" });
  } catch (e) {
    log.warn("indexnow.crawl_hook_failed", { projectId: o.projectId, err: e instanceof Error ? e.message : String(e) });
    return 0;
  }
}
