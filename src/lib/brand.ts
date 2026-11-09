// Product brand. The site, emails, icons and share reports all read from here.
export const BRAND = {
  name: "MyWebRank",
  /** Logo wordmark, shown in capitals as MYWEB + RANK (two colours). */
  wordmark: ["MyWeb", "Rank"] as const,
  domain: "mywebrank.tech",
  tagline: "See how AI search talks about your brand — and fix it safely.",
  /** One-sentence entity description used in schema.org, llms.txt and social cards (search + AI engines). */
  description:
    "MyWebRank is an SEO, AEO and GEO platform and done-for-you service that audits websites for Google and AI search, tracks how often ChatGPT, Gemini, Perplexity and Claude mention a brand, and ships approved fixes.",
  supportEmail: "support@mywebrank.tech",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  /**
   * Official profiles (LinkedIn, X, YouTube, Crunchbase, G2, Product Hunt…), comma-separated in BRAND_SAME_AS.
   * These go into Organization.sameAs, which is how Google and AI assistants tie the brand name to one entity.
   */
  sameAs: (process.env.BRAND_SAME_AS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^https:\/\//.test(s)),
};
