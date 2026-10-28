import { Bot, MessageSquareQuote, Search, ShieldCheck } from "lucide-react";
import type { Pillar } from "@/lib/report/types";

export const PILLAR_ORDER: Pillar[] = ["seo", "aeo", "geo", "brand"];

/** Short tag shown on issues and filter chips. */
export const PILLAR_SHORT: Record<Pillar, string> = { seo: "SEO", aeo: "AEO", geo: "GEO", brand: "Brand" };

/** One-line, jargon-free explanation of each pillar for a small-business owner. */
export const PILLAR_EXPLAINER: Record<Pillar, string> = {
  seo: "SEO = how easily Google and other search engines can find, read and understand your pages.",
  aeo: "AEO = how easily answer engines and Google's AI Overviews can lift a direct answer from your pages.",
  geo: "GEO = how often AI assistants like ChatGPT and Gemini mention, cite and recommend you when people ask.",
  brand: "Brand = how clearly your business is described, and whether AI assistants get the facts about you right.",
};

export const PILLAR_ICON: Record<Pillar, React.ReactNode> = {
  seo: <Search />,
  aeo: <MessageSquareQuote />,
  geo: <Bot />,
  brand: <ShieldCheck />,
};
