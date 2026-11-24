// Hindi guides (/hi/learn/<slug>), one file each in this folder. Their English counterparts are paired in
// src/components/marketing/hi/pairs.ts (ARTICLE_HINDI_PAIRS) for hreflang and the language switch.
import type { Article } from "@/lib/learn/articles";
import { article as aeoKyaHai } from "./aeo-kya-hai";
import { article as geoKyaHai } from "./geo-kya-hai";
import { article as chatgptMention } from "./chatgpt-mention";

export const HINDI_ARTICLES: Article[] = [aeoKyaHai, geoKyaHai, chatgptMention];

export function getHindiArticle(slug: string): Article | undefined {
  return HINDI_ARTICLES.find((a) => a.slug === slug);
}
