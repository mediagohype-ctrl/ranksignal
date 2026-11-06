// Product brand. The site, emails, icons and share reports all read from here.
export const BRAND = {
  name: "MyWebRank",
  /** Logo wordmark, shown in capitals as MYWEB + RANK (two colours). */
  wordmark: ["MyWeb", "Rank"] as const,
  domain: "mywebrank.tech",
  tagline: "See how AI search talks about your brand — and fix it safely.",
  supportEmail: "support@mywebrank.tech",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
};
