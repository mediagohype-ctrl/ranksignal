// Locations offered in the paid-data features. DataForSEO accepts `location_name` in Google Ads format
// ("City,Region,Country") and `location_code` for countries. Indian cities first: our customers are mostly local businesses.
export interface DfsLocation {
  /** Stable id stored in our database. */
  id: string;
  label: string;
  /** Sent as location_name (cities) — omitted when locationCode is used. */
  locationName?: string;
  /** Sent as location_code (countries). */
  locationCode?: number;
}

export const DFS_LOCATIONS: DfsLocation[] = [
  { id: "in", label: "All of India", locationCode: 2356 },
  { id: "in-delhi", label: "New Delhi", locationName: "New Delhi,Delhi,India" },
  { id: "in-mumbai", label: "Mumbai", locationName: "Mumbai,Maharashtra,India" },
  { id: "in-bengaluru", label: "Bengaluru", locationName: "Bengaluru,Karnataka,India" },
  { id: "in-hyderabad", label: "Hyderabad", locationName: "Hyderabad,Telangana,India" },
  { id: "in-chennai", label: "Chennai", locationName: "Chennai,Tamil Nadu,India" },
  { id: "in-kolkata", label: "Kolkata", locationName: "Kolkata,West Bengal,India" },
  { id: "in-pune", label: "Pune", locationName: "Pune,Maharashtra,India" },
  { id: "in-ahmedabad", label: "Ahmedabad", locationName: "Ahmedabad,Gujarat,India" },
  { id: "in-jaipur", label: "Jaipur", locationName: "Jaipur,Rajasthan,India" },
  { id: "in-lucknow", label: "Lucknow", locationName: "Lucknow,Uttar Pradesh,India" },
  { id: "in-chandigarh", label: "Chandigarh", locationName: "Chandigarh,Chandigarh,India" },
  { id: "in-gurugram", label: "Gurugram", locationName: "Gurugram,Haryana,India" },
  { id: "in-noida", label: "Noida", locationName: "Noida,Uttar Pradesh,India" },
  { id: "in-kochi", label: "Kochi", locationName: "Kochi,Kerala,India" },
  { id: "in-indore", label: "Indore", locationName: "Indore,Madhya Pradesh,India" },
  { id: "us", label: "United States", locationCode: 2840 },
  { id: "gb", label: "United Kingdom", locationCode: 2826 },
  { id: "ae", label: "United Arab Emirates", locationCode: 2784 },
  { id: "sg", label: "Singapore", locationCode: 2702 },
  { id: "au", label: "Australia", locationCode: 2036 },
  { id: "ca", label: "Canada", locationCode: 2124 },
];

export const DEFAULT_LOCATION_ID = "in";

export function locationById(id: string | null | undefined): DfsLocation {
  return DFS_LOCATIONS.find((l) => l.id === id) ?? DFS_LOCATIONS[0];
}

/** Fields to merge into a DataForSEO task for this location. */
export function locationFields(id: string | null | undefined): { location_code: number } | { location_name: string } {
  const l = locationById(id);
  return l.locationCode !== undefined ? { location_code: l.locationCode } : { location_name: l.locationName! };
}

/**
 * The country a location belongs to. DataForSEO Labs and Keywords Data work at country level, so city choices
 * fall back to their country for search volumes.
 */
export function countryCodeFor(id: string | null | undefined): number {
  const l = locationById(id);
  if (l.locationCode !== undefined) return l.locationCode;
  return 2356; // every city in the list is in India
}

export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
] as const;
export type LanguageId = (typeof LANGUAGES)[number]["id"];
export function languageCode(id: string | null | undefined): LanguageId {
  return id === "hi" ? "hi" : "en";
}

/** Normalise a domain the user typed ("https://www.Acme.in/path" → "acme.in"). Null when it isn't a domain. */
export function normaliseDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw || raw.length > 253) return null;
  let host = raw;
  try {
    host = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return null;
  if (/^(localhost|.*\.local|.*\.internal)$/.test(host)) return null;
  return host;
}

/** Normalise a keyword: trim, collapse spaces, lower-case, cap at 80 characters (Google's practical limit). */
export function normaliseKeyword(input: string): string | null {
  const k = input.replace(/\s+/g, " ").trim().toLowerCase();
  if (!k || k.length > 80) return null;
  return k;
}
