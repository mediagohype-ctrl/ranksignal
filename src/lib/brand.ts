// Product brand. The site, emails, icons and share reports all read from here.
export const BRAND = {
  name: "MyWebRank",
  /** Logo wordmark, shown in capitals as MYWEB + RANK (two colours). */
  wordmark: ["MyWeb", "Rank"] as const,
  domain: "mywebrank.tech",
  /** The promise (Website Blueprint, Nov 2026): used everywhere a one-line description of the product is needed. */
  tagline: "Get found on Google and ChatGPT. We show you what to fix, or we fix it for you.",
  /** The proof line (Website Blueprint): shown on the homepage, Pricing and Done-for-you. Owner-confirmed figure. */
  proof: "10,000+ businesses served by our team",
  /** One-sentence entity description used in schema.org, llms.txt and social cards (search + AI engines). */
  description:
    "MyWebRank is an SEO, AEO and GEO platform and done-for-you service that audits websites for Google and AI search, tracks how often ChatGPT, Gemini, Perplexity and Claude mention a brand, and ships approved fixes.",
  supportEmail: "support@mywebrank.tech",
  /** WhatsApp number for sales chats (Custom plan), digits only with country code. Override with BRAND_WHATSAPP. */
  whatsapp: (process.env.BRAND_WHATSAPP ?? "918447788703").replace(/\D/g, ""),
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  /**
   * Official profiles (LinkedIn, X, YouTube, Crunchbase, G2, Product Hunt…), comma-separated in BRAND_SAME_AS.
   * These go into Organization.sameAs, which is how Google and AI assistants tie the brand name to one entity.
   */
  sameAs: (process.env.BRAND_SAME_AS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^https:\/\//.test(s)),
  // No phone number anywhere on the site, by owner decision: there is deliberately no BRAND_PHONE.
  /** Public business address from BRAND_ADDRESS_*; empty fields are left out (a town alone is enough). */
  address: {
    street: (process.env.BRAND_ADDRESS_STREET ?? "").trim(),
    locality: (process.env.BRAND_ADDRESS_LOCALITY ?? "").trim(),
    region: (process.env.BRAND_ADDRESS_REGION ?? "").trim(),
    postalCode: (process.env.BRAND_ADDRESS_POSTAL_CODE ?? "").trim(),
    country: (process.env.BRAND_ADDRESS_COUNTRY ?? "").trim() || "IN",
  },
};

/** True when at least a street or town is configured (a country alone is not an address). */
export function hasBrandAddress(): boolean {
  return Boolean(BRAND.address.street || BRAND.address.locality);
}

/** Short "Town, Country" line for the footer (e.g. "New Delhi, India"), or "" when no town is set. */
export function brandLocationLine(): string {
  const a = BRAND.address;
  if (!a.locality) return "";
  return [a.locality, a.country.toUpperCase() === "IN" ? "India" : a.country].filter(Boolean).join(", ");
}

/** One-line postal address for legal pages, or "" when BRAND_ADDRESS_* is not set. */
export function brandAddressLine(): string {
  if (!hasBrandAddress()) return "";
  const a = BRAND.address;
  const country = a.country.toUpperCase() === "IN" ? "India" : a.country;
  return [a.street, a.locality, [a.region, a.postalCode].filter(Boolean).join(" "), country].filter(Boolean).join(", ");
}
