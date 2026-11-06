// Fix guides for SEO checks (seo.*). Keyed by check id.
// The guides themselves live in ./google/ (on-page, content, technical); "seo.titles" is in titles.ts.
import type { FixGuide } from "../types";
import { canonicalGuide, h1Guide, imageAltGuide, metaDescriptionGuide, openGraphGuide } from "./google/onpage";
import { brokenLinksGuide, duplicateContentGuide, internalLinksGuide, thinContentGuide } from "./google/content";
import { httpsGuide, indexabilityGuide, mobileViewportGuide, pageSpeedGuide, redirectsGuide, sitemapGuide } from "./google/technical";

export const GOOGLE_GUIDES: Record<string, FixGuide> = {
  "seo.meta_description": metaDescriptionGuide,
  "seo.h1": h1Guide,
  "seo.canonical": canonicalGuide,
  "seo.indexability": indexabilityGuide,
  "seo.redirects": redirectsGuide,
  "seo.broken_links": brokenLinksGuide,
  "seo.internal_links": internalLinksGuide,
  "seo.image_alt": imageAltGuide,
  "seo.thin_content": thinContentGuide,
  "seo.duplicate_content": duplicateContentGuide,
  "seo.sitemap": sitemapGuide,
  "seo.https": httpsGuide,
  "seo.mobile_viewport": mobileViewportGuide,
  "seo.page_speed_proxy": pageSpeedGuide,
  "seo.open_graph": openGraphGuide,
};
