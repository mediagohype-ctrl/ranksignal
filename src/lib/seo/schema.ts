// Shared schema.org builders for our own marketing site (entity graph for Google and AI assistants).
import { BRAND, hasBrandAddress } from "@/lib/brand";
import { LEGAL_ENTITY } from "@/lib/site";
import { PAGE_SEO, PAGE_UPDATED, type PageSeo } from "./pages";

/** schema.org PostalAddress from BRAND_ADDRESS_*, or undefined when no street/town is configured. */
export function postalAddressLd(): Record<string, unknown> | undefined {
  if (!hasBrandAddress()) return undefined;
  const a = BRAND.address;
  return {
    "@type": "PostalAddress",
    ...(a.street ? { streetAddress: a.street } : {}),
    ...(a.locality ? { addressLocality: a.locality } : {}),
    ...(a.region ? { addressRegion: a.region } : {}),
    ...(a.postalCode ? { postalCode: a.postalCode } : {}),
    addressCountry: a.country,
  };
}

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
  const address = postalAddressLd();
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
    ...(address ? { address } : {}),
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

/**
 * WebPage (or a subtype) for a static marketing page, with the freshness dates from src/lib/seo/pages.ts.
 * `@id` is `<url>#webpage`; `extra` adds or overrides fields (e.g. mainEntity on a CollectionPage).
 */
export function webPageLd(
  path: string,
  opts: { type?: string; name?: string; description?: string; extra?: Record<string, unknown>; base?: string } = {},
): Record<string, unknown> {
  const base = opts.base ?? siteUrl();
  const url = path === "/" ? `${base}/` : `${base}${path}`;
  const seo = (PAGE_SEO as Record<string, PageSeo | undefined>)[path];
  const modified = PAGE_UPDATED[path];
  return {
    "@context": "https://schema.org",
    "@type": opts.type ?? "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: opts.name ?? seo?.title ?? BRAND.name,
    ...(opts.description ?? seo?.description ? { description: opts.description ?? seo?.description } : {}),
    inLanguage: "en-IN",
    ...(seo?.published ? { datePublished: seo.published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    isPartOf: { "@id": `${base}/#website` },
    about: { "@id": `${base}/#organization` },
    publisher: { "@id": `${base}/#organization` },
    primaryImageOfPage: { "@type": "ImageObject", url: `${base}/opengraph-image`, width: 1200, height: 630 },
    ...opts.extra,
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

/**
 * Plain text of a rendered answer (string, number, array or React element tree), so FAQPage JSON-LD repeats
 * exactly the words visitors see. Reads `props.children` recursively; nothing from React is imported.
 */
export function nodeText(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    return nodeText((node as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

/** FAQPage from visible Q&A items whose answers may be JSX (e.g. the `Qa[]` arrays rendered by QaSection). */
export function faqLdFromQa(items: { q: string; a: unknown }[]): Record<string, unknown> {
  return faqLd(items.map((i) => ({ q: i.q, a: nodeText(i.a).replace(/\s+/g, " ").trim() })));
}

export function faqLd(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
