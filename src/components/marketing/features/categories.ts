// Groups for the /features page. Order here is the order on the page; every Feature.category must appear once.
import type { Feature, FeatureAvailability, FeatureCategory } from "@/components/marketing/content";
import { backlinksEnabled, dfsConfigured } from "@/lib/dataforseo/status";
import { isPlacesConfigured } from "@/lib/business-profile/places";

export interface FeatureCategoryMeta {
  id: FeatureCategory;
  /** Anchor id for the category's section. */
  anchor: string;
  title: string;
  intro: string;
}

export const FEATURE_CATEGORIES: FeatureCategoryMeta[] = [
  {
    id: "website",
    anchor: "check-your-website",
    title: "Check your website",
    intro: "Find what stops Google and AI from reading, trusting and showing your pages — in plain words, sorted by what matters most.",
  },
  {
    id: "ai",
    anchor: "get-found-by-ai",
    title: "Get found by AI",
    intro: "See whether ChatGPT, Gemini, Google's AI and other assistants name and link your business when customers ask (that's AEO and GEO).",
  },
  {
    id: "fix",
    anchor: "fix-safely",
    title: "Fix safely",
    intro: "Approve every change before it goes live, undo it in one click, and tell search engines when pages change.",
  },
  {
    id: "google",
    anchor: "track-google",
    title: "Track Google",
    intro: "Follow your place in Google's results (SEO), research what people search for, and watch competitors, backlinks and your Maps listing.",
  },
  {
    id: "updates",
    anchor: "reports-and-alerts",
    title: "Reports, alerts and language",
    intro: "Stay up to date without logging in every day, in your market and your language.",
  },
  {
    id: "agencies",
    anchor: "agencies-and-developers",
    title: "For agencies and developers",
    intro: "Report to clients, see every website at once, and use your data in your own tools.",
  },
];

export function featuresIn(features: Feature[], category: FeatureCategory): Feature[] {
  return features.filter((f) => f.category === category);
}

/**
 * Is the outside data a feature needs switched on? Env-only checks, safe on a static marketing page.
 * Features without an `availability` requirement are always live.
 */
export function isFeatureLive(availability: FeatureAvailability | undefined): boolean {
  switch (availability) {
    case undefined:
      return true;
    case "google-data":
      return dfsConfigured();
    case "backlink-data":
      return backlinksEnabled();
    case "maps-data":
      return isPlacesConfigured();
  }
}

/** One plain sentence on what a not-yet-live feature is waiting for. */
export const WAITING_FOR: Record<FeatureAvailability, string> = {
  "google-data": "This uses live Google data from our data partner, which we're switching on soon.",
  "backlink-data": "This uses backlink data from our data partner, which we're switching on soon.",
  "maps-data": "This uses Google Maps data, which we're switching on soon.",
};
