// The score a visitor saw in the public free check for this website, if we have it (Lead rows: source "free_check",
// url, score). Used once on Home to explain why the first full score differs. Read-only; never throws.
import { db } from "@/lib/db";

/** Pages the free check reads: the homepage plus up to 4 key pages (src/lib/free-check/run.ts → MAX_KEY_PAGES). */
export const FREE_CHECK_PAGES = 5;
const LOOKBACK_DAYS = 90;

/** "https://www.Example.com/x" → "example.com"; "" when it isn't a URL. */
export function siteKey(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Pure: the newest free-check score for exactly this website (same host, www ignored) at or before `before`. */
export function pickFreeCheckScore(
  leads: { url: string | null; score: number | null; createdAt: Date }[],
  websiteUrl: string,
  before: Date,
): number | null {
  const host = siteKey(websiteUrl);
  if (!host) return null;
  const hit = leads
    .filter((l) => typeof l.score === "number" && siteKey(l.url) === host && l.createdAt.getTime() <= before.getTime())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return hit?.score ?? null;
}

/** Free-check score recorded for this website before its first full check (within the last 90 days of that check). */
export async function freeCheckScoreFor(websiteUrl: string, firstFullCheckAt: Date): Promise<number | null> {
  const host = siteKey(websiteUrl);
  if (!host) return null;
  try {
    const leads = await db.lead.findMany({
      where: {
        source: "free_check",
        score: { not: null },
        url: { contains: host, mode: "insensitive" },
        createdAt: { lte: firstFullCheckAt, gte: new Date(firstFullCheckAt.getTime() - LOOKBACK_DAYS * 86_400_000) },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { url: true, score: true, createdAt: true },
    });
    return pickFreeCheckScore(leads, websiteUrl, firstFullCheckAt);
  } catch {
    return null;
  }
}
