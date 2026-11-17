// Can this website's owner get server logs at all? (pure, client-safe)
// AI crawler visits need a server access log or a Cloudflare Worker. Hosted website builders (Shopify, Wix,
// Framer, Squarespace, Webflow) don't give owners their logs, so the upload steps are a dead end for them — the
// page says so honestly instead of showing the upload box first.
import { PLATFORM_LABEL, isPlatform, type Platform } from "@/lib/platform/detect";

/** Website builders that host the site for you and don't hand out server access logs. */
export const HOSTED_BUILDERS: readonly Platform[] = ["shopify", "wix", "framer", "squarespace", "webflow"];

export function isHostedBuilder(platform: string | null | undefined): boolean {
  return isPlatform(platform) && HOSTED_BUILDERS.includes(platform);
}

/**
 * True when "AI crawler visits" can work for this website: self-hosted (or unknown) sites, and any site once it
 * has crawler data. Menus can use this to hide the page for hosted builders.
 */
export function aiCrawlerVisitsAvailable(platform: string | null | undefined, hasData = false): boolean {
  return hasData || !isHostedBuilder(platform);
}

/** The honest note shown at the top of the page for hosted builders; null for everyone else. */
export function hostedBuilderNote(platform: string | null | undefined): { title: string; body: string } | null {
  if (!isPlatform(platform) || !isHostedBuilder(platform)) return null;
  const name = PLATFORM_LABEL[platform];
  return {
    title: `Your website is on ${name}, which doesn't give you server logs`,
    body: "This page works for self-hosted websites, or websites behind Cloudflare. If your domain goes through Cloudflare, the live logging steps below will still work. Otherwise there is nothing to set up here — your AI answers and website checks are not affected.",
  };
}
