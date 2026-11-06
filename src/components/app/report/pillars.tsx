import { Bot, MessageSquareQuote, Search, ShieldCheck } from "lucide-react";
import type { Pillar } from "@/lib/report/types";

export const PILLAR_ORDER: Pillar[] = ["seo", "aeo", "geo", "brand"];

/** Score names shown everywhere (SEO, AEO, GEO, Brand); PILLAR_EXPLAINER gives the plain-English line under each. */
export const PILLAR_SHORT: Record<Pillar, string> = { seo: "SEO", aeo: "AEO", geo: "GEO", brand: "Brand" };

/** Technical name of each pillar (same as PILLAR_SHORT; kept for callers). */
export const PILLAR_TECH: Record<Pillar, string> = { seo: "SEO", aeo: "AEO", geo: "GEO", brand: "Brand" };

/** Pillars hidden unless Expert mode is on (none: all four scores are always shown). */
export const EXPERT_ONLY_PILLARS: Pillar[] = [];

export function visiblePillars<T extends { pillar: Pillar }>(pillars: T[], expert: boolean): T[] {
  return expert ? pillars : pillars.filter((p) => !EXPERT_ONLY_PILLARS.includes(p.pillar));
}

/** One-line, jargon-free explanation of each pillar for a small-business owner. */
export const PILLAR_EXPLAINER: Record<Pillar, string> = {
  seo: "How easily Google can find, read and understand your pages.",
  aeo: "How easily Google and AI tools can lift a short, direct answer from your pages.",
  geo: "Whether AI tools like ChatGPT and Gemini can read your site, and how often they name and link to you.",
  brand: "How clearly your business is described, and whether AI tools get the facts about you right.",
};

export const PILLAR_ICON: Record<Pillar, React.ReactNode> = {
  seo: <Search />,
  aeo: <MessageSquareQuote />,
  geo: <Bot />,
  brand: <ShieldCheck />,
};
