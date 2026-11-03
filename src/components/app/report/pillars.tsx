import { Bot, MessageSquareQuote, Search, ShieldCheck } from "lucide-react";
import type { Pillar } from "@/lib/report/types";

export const PILLAR_ORDER: Pillar[] = ["seo", "aeo", "geo", "brand"];

/** Short tag shown on issues and filter chips (plain words, docs/PLAIN_WORDS.md). */
export const PILLAR_SHORT: Record<Pillar, string> = { seo: "Google health", aeo: "Easy to quote", geo: "Ready for AI", brand: "AI knows you" };

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
