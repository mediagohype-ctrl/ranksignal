// Business facts the owner confirms in setup (screen 2, "Is this right?"). Pure + zod only, so the setup wizard,
// the setup API and project create can all share it. Stored as Project.facts.
import { z } from "zod";

export interface BusinessFacts {
  /** Business name customers know (becomes brandNames[0] and the project/org name). */
  name: string;
  /** What the business sells, in plain words ("Wedding cakes and sweets"). */
  sells: string;
  /** Who the customers are ("Families in Pune planning parties"). */
  customers: string;
  city: string;
  /** ISO 3166-1 alpha-2, e.g. "IN". */
  country: string;
  /** ISO 639-1, e.g. "en", "hi". */
  language: string;
}

export const COUNTRIES: [string, string][] = [
  ["IN", "India"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["AE", "United Arab Emirates"],
  ["SG", "Singapore"],
  ["AU", "Australia"],
  ["CA", "Canada"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["NL", "Netherlands"],
  ["ZA", "South Africa"],
  ["NZ", "New Zealand"],
  ["IE", "Ireland"],
  ["MY", "Malaysia"],
  ["SA", "Saudi Arabia"],
  ["NP", "Nepal"],
  ["LK", "Sri Lanka"],
  ["BD", "Bangladesh"],
];

export const LANGUAGES: [string, string][] = [
  ["en", "English"],
  ["hi", "Hindi"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["mr", "Marathi"],
  ["bn", "Bengali"],
  ["gu", "Gujarati"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["pa", "Punjabi"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["ar", "Arabic"],
];

const COUNTRY_CODES = new Set(COUNTRIES.map(([c]) => c));
const LANGUAGE_CODES = new Set(LANGUAGES.map(([c]) => c));

/** Extra spellings seen in addresses / JSON-LD (lowercased). */
const COUNTRY_ALIASES: Record<string, string> = {
  india: "IN",
  bharat: "IN",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "u.s.a.": "US",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  "united arab emirates": "AE",
  uae: "AE",
  singapore: "SG",
  australia: "AU",
  canada: "CA",
  germany: "DE",
  deutschland: "DE",
  france: "FR",
  netherlands: "NL",
  "south africa": "ZA",
  "new zealand": "NZ",
  ireland: "IE",
  malaysia: "MY",
  "saudi arabia": "SA",
  nepal: "NP",
  "sri lanka": "LK",
  bangladesh: "BD",
};

/** "India" / "IN" / "ind" / "in" → "IN". Any valid-looking 2-letter code is accepted; unknown names → null. */
export function countryCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  const lower = t.toLowerCase().replace(/\s+/g, " ");
  if (lower === "ind") return "IN";
  return COUNTRY_ALIASES[lower] ?? null;
}

/** html lang "en-IN" / "hi" / "EN_us" → "en"; unknown → null. */
export function languageCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^\s*([A-Za-z]{2,3})(?:[-_][A-Za-z0-9]+)*\s*$/.exec(raw);
  if (!m) return null;
  return m[1].toLowerCase();
}

/** Region part of an html lang ("en-IN" → "IN"), when present. */
export function countryFromLang(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = /^\s*[A-Za-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(raw);
  return m ? m[1].toUpperCase() : null;
}

export function countryLabel(code: string): string {
  return COUNTRIES.find(([c]) => c === code)?.[1] ?? code;
}

export function isKnownCountry(code: string): boolean {
  return COUNTRY_CODES.has(code);
}

export function isKnownLanguage(code: string): boolean {
  return LANGUAGE_CODES.has(code);
}

const text = (max: number) => z.string().trim().max(max);

/** Stored/accepted shape. Everything except the name may be blank (the owner may not know or care). */
export const businessFactsSchema = z.object({
  name: text(120).pipe(z.string().min(1, "Add your business name.")),
  sells: text(300).default(""),
  customers: text(300).default(""),
  city: text(120).default(""),
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use a 2-letter country code, e.g. IN")
    .transform((c) => c.toUpperCase())
    .default("IN"),
  language: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,3}$/, "Use a language code, e.g. en")
    .transform((l) => l.toLowerCase())
    .default("en"),
});

export function emptyFacts(name = ""): BusinessFacts {
  return { name, sells: "", customers: "", city: "", country: "IN", language: "en" };
}

/** "sharma-sweets.co.in" → "Sharma Sweets" (fallback business name). */
export function nameFromHost(host: string): string {
  const label = host.replace(/^www\./i, "").split(".")[0] ?? "";
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Project fields derived from confirmed facts (setup removes the separate project-name / other-names steps). */
export function projectFieldsFromFacts(f: BusinessFacts): {
  name: string;
  brandNames: string[];
  categories: string[];
  audience?: string;
  countries: string[];
  languages: string[];
} {
  const sells = f.sells.trim();
  const audience = [f.customers.trim(), f.city.trim() ? `in ${f.city.trim()}` : ""].filter(Boolean).join(" ");
  return {
    name: f.name.trim().slice(0, 120),
    brandNames: [f.name.trim().slice(0, 120)],
    categories: sells ? [sells.slice(0, 120)] : [],
    audience: audience ? audience.slice(0, 500) : undefined,
    countries: [f.country],
    languages: [f.language],
  };
}

/** Generic org name used at sign-up until setup tells us the real business name. */
export const PLACEHOLDER_ORG_NAME = "My business";

const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|aol|proton|protonmail|rediffmail|zoho|gmx|mail|yandex)\./i;

/** Sign-up org placeholder: the email's company domain ("acme.in" → "Acme"), or "My business" for free-mail addresses. */
export function placeholderOrgName(email: string): string {
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  if (!domain || FREE_MAIL.test(domain)) return PLACEHOLDER_ORG_NAME;
  return nameFromHost(domain).slice(0, 120) || PLACEHOLDER_ORG_NAME;
}

/** True when the org still carries the sign-up placeholder (so setup may rename it from the facts). */
export function isPlaceholderOrgName(orgName: string, email: string): boolean {
  const n = orgName.trim();
  return n === PLACEHOLDER_ORG_NAME || n === placeholderOrgName(email);
}

/** Customer questions shown in setup: the plan's per-check cap, kept within 10–25. */
export function setupQuestionCount(maxPromptsPerRun: number): number {
  return Math.max(10, Math.min(25, Math.floor(maxPromptsPerRun) || 10));
}
