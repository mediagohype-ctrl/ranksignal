// Shared schema.org builders for our own marketing site (entity graph for Google and AI assistants).
import { BRAND } from "@/lib/brand";
import { LEGAL_ENTITY } from "@/lib/site";

export function siteUrl(): string {
  return BRAND.appUrl.replace(/\/+$/, "");
}

/** Topics the brand is an authority on — Organization.knowsAbout helps engines file us under these queries. */
export const KNOWS_ABOUT = [
  "Search engine optimization (SEO)",
  "Answer engine optimization (AEO)",
  "Generative engine optimization (GEO)",
  "AI search visibility",
  "Technical SEO audit",
  "Website SEO report",
  "Schema markup",
  "llms.txt",
  "Local SEO",
  "Google AI Overviews",
];

export function organizationLd(base = siteUrl()): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: BRAND.name,
    alternateName: ["My Web Rank", BRAND.domain],
    legalName: LEGAL_ENTITY,
    url: `${base}/`,
    logo: { "@type": "ImageObject", url: `${base}/brand/logo-mark-512.png`, width: 512, height: 512 },
    image: `${base}/opengraph-image`,
    email: BRAND.supportEmail,
    description: BRAND.description,
    slogan: BRAND.tagline,
    areaServed: [{ "@type": "Country", name: "India" }, "Worldwide"],
    knowsAbout: KNOWS_ABOUT,
    ...(BRAND.sameAs.length ? { sameAs: BRAND.sameAs } : {}),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: BRAND.supportEmail,
      url: `${base}/contact`,
      availableLanguage: ["English", "Hindi"],
    },
  };
}

export function websiteLd(base = siteUrl()): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: BRAND.name,
    alternateName: "My Web Rank",
    url: `${base}/`,
    description: BRAND.description,
    publisher: { "@id": `${base}/#organization` },
    inLanguage: "en-IN",
  };
}

export type Crumb = { name: string; path: string };

/** BreadcrumbList; Home is prepended automatically. */
export function breadcrumbLd(crumbs: Crumb[], base = siteUrl()): Record<string, unknown> {
  const all = [{ name: "Home", path: "/" }, ...crumbs];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.path === "/" ? `${base}/` : `${base}${c.path}`,
    })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
