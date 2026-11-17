// "Where is your website built?" — the choices on the Connect website page, and which connection (if any) each
// one has. Pure, so the page, the panel and tests share it. Honest by design: a platform with no connection says so.
import { PLATFORM_LABEL, type Platform } from "@/lib/platform/detect";

export interface PlatformChoice {
  id: string;
  /** Name shown to people ("Shopify"). */
  name: string;
  /** The connector that serves it (a key of CONNECTOR_DESCRIPTORS), or null when we have no connection. */
  connector: string | null;
}

export const PLATFORM_CHOICES: PlatformChoice[] = [
  { id: "wordpress", name: "WordPress", connector: "wordpress" },
  { id: "shopify", name: "Shopify", connector: "shopify" },
  { id: "webflow", name: "Webflow", connector: "webflow" },
  { id: "wix", name: "Wix", connector: "wix" },
  { id: "framer", name: "Framer", connector: null },
  { id: "squarespace", name: "Squarespace", connector: null },
  { id: "code", name: "Custom code (on GitHub)", connector: "github" },
  { id: "contentful", name: "Contentful", connector: "contentful" },
  { id: "sanity", name: "Sanity", connector: "sanity" },
  { id: "other", name: "Something else", connector: null },
];

/** The choice to pre-select for the platform our website check detected (null = we couldn't tell). */
export function choiceForPlatform(platform: Platform | null | undefined): PlatformChoice | null {
  if (!platform) return null;
  const id = platform === "nextjs" || platform === "react" || platform === "custom" ? "code" : platform;
  return PLATFORM_CHOICES.find((c) => c.id === id) ?? null;
}

/** "We found Shopify. Is that right?" — the name of what we detected, in the words of src/lib/platform/detect. */
export function detectedName(platform: Platform | null | undefined): string | null {
  if (!platform || platform === "custom") return null;
  return platform === "nextjs" || platform === "react" ? PLATFORM_LABEL[platform] : (choiceForPlatform(platform)?.name ?? PLATFORM_LABEL[platform]);
}

/** What we say when a platform has no connection (Framer, Squarespace, anything else). */
export function noConnectionLine(name: string): string {
  return `We don't have a ${name} connection. Our team makes the changes for you by hand.`;
}
