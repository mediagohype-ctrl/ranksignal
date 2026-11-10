// Google Places API (New) client — fixed host places.googleapis.com via the SSRF-safe client, API key from env only
// (sent as a header, never logged, never in errors). Field masks keep each call on the cheapest SKU that has the data.
//
// Why Places and not the Business Profile API: the Business Profile API (reviews, replies, insights, owner-written
// description) needs Google's approval of our project. Places gives the public view of the listing, which is enough
// to monitor rating, reviews count, completeness and NAP consistency. Full review management is a future step.
import { HttpError } from "@/lib/api";
import { safeRequestJson } from "@/lib/net/safe-request";

const HOST = "places.googleapis.com";
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 1024 * 1024;

/** Text Search: Pro SKU fields only (id, name, address). */
export const SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress";

/** Place Details for a snapshot. rating/reviews/hours/phone/website put this in Enterprise + Atmosphere. */
export const DETAILS_FIELD_MASK = [
  "id", "displayName", "formattedAddress", "nationalPhoneNumber", "internationalPhoneNumber", "websiteUri", "googleMapsUri",
  "rating", "userRatingCount", "businessStatus", "primaryType", "primaryTypeDisplayName", "types", "regularOpeningHours",
  "photos", "editorialSummary", "reviews",
].join(",");

export const NOT_CONFIGURED_MESSAGE =
  "Business Profile monitoring isn't set up on this server yet. The owner needs to add GOOGLE_PLACES_API_KEY (Google Cloud, " +
  "Places API (New) enabled) and restart the app.";

export function isPlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
}

function apiKey(): string {
  const k = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!k) throw new HttpError(501, "places_not_configured", NOT_CONFIGURED_MESSAGE);
  return k;
}

export const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,300}$/;

export class PlacesError extends Error {
  constructor(public status: number, public kind: "not_found" | "quota" | "denied" | "bad_request" | "unavailable", message: string) {
    super(message);
    this.name = "PlacesError";
  }
}

function classify(status: number, data: unknown): PlacesError {
  const msg = (() => {
    const e = data && typeof data === "object" ? (data as { error?: { message?: unknown } }).error : undefined;
    return typeof e?.message === "string" ? e.message.slice(0, 200) : `HTTP ${status}`;
  })();
  if (status === 404) return new PlacesError(status, "not_found", "Google Maps no longer has this place. Pick your business again.");
  if (status === 429) return new PlacesError(status, "quota", "Google Maps' API limit was reached. We'll try again later.");
  if (status === 401 || status === 403) return new PlacesError(status, "denied", `Google refused the request (${msg}). Check the Places API key.`);
  if (status === 400) return new PlacesError(status, "bad_request", `Google couldn't read that request (${msg}).`);
  return new PlacesError(status, "unavailable", "Google Maps didn't respond. We'll try again later.");
}

async function call<T>(url: string, fieldMask: string, json?: unknown): Promise<T> {
  let res;
  try {
    res = await safeRequestJson<T>(url, {
      method: json === undefined ? "GET" : "POST",
      json,
      headers: { "X-Goog-Api-Key": apiKey(), "X-Goog-FieldMask": fieldMask },
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_BYTES,
      allowedHosts: [HOST],
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new PlacesError(0, "unavailable", "Couldn't reach Google Maps. Please try again.");
  }
  if (!res.ok) throw classify(res.status, res.data);
  return (res.data ?? {}) as T;
}

// ---- raw shapes (untrusted) ----------------------------------------------------------------------------------------

interface LocalizedText {
  text?: string;
}
export interface RawPlace {
  id?: string;
  displayName?: LocalizedText;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryType?: string;
  primaryTypeDisplayName?: LocalizedText;
  types?: string[];
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: unknown[] };
  photos?: unknown[];
  editorialSummary?: LocalizedText;
  reviews?: {
    rating?: number;
    text?: LocalizedText;
    originalText?: LocalizedText;
    relativePublishTimeDescription?: string;
    publishTime?: string;
    authorAttribution?: { displayName?: string; uri?: string };
  }[];
}

export interface PlaceCandidate {
  placeId: string;
  name: string;
  address: string | null;
}

/** Up to 5 matches for "business name + city". */
export async function searchPlaces(textQuery: string, regionCode = "IN"): Promise<PlaceCandidate[]> {
  const r = await call<{ places?: RawPlace[] }>(`https://${HOST}/v1/places:searchText`, SEARCH_FIELD_MASK, {
    textQuery: textQuery.slice(0, 200),
    pageSize: 5,
    regionCode,
    languageCode: "en",
  });
  return (r.places ?? [])
    .filter((p) => typeof p.id === "string" && PLACE_ID_RE.test(p.id))
    .map((p) => ({ placeId: p.id!, name: str(p.displayName?.text, 200) ?? "(no name)", address: str(p.formattedAddress, 500) }));
}

export async function getPlaceDetails(placeId: string): Promise<RawPlace> {
  if (!PLACE_ID_RE.test(placeId)) throw new PlacesError(400, "bad_request", "That doesn't look like a Google Maps place.");
  return call<RawPlace>(`https://${HOST}/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, DETAILS_FIELD_MASK);
}

// ---- normalized snapshot (stored in BusinessProfileSnapshot.data) --------------------------------------------------

/** Places returns at most this many photos and reviews, whatever the real totals are. */
export const PLACES_MAX_PHOTOS = 10;
export const PLACES_MAX_REVIEWS = 5;

export interface PlaceReview {
  rating: number | null;
  text: string | null;
  author: string | null;
  authorUri: string | null;
  when: string | null;
  publishTime: string | null;
}

export interface PlaceSnapshot {
  placeId: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  internationalPhone: string | null;
  website: string | null;
  mapsUri: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  primaryType: string | null;
  category: string | null;
  types: string[];
  hasHours: boolean;
  hours: string[];
  photosCount: number;
  /** Google's own summary of the place (Places can't read the owner-written description). */
  editorialSummary: string | null;
  reviews: PlaceReview[];
}

function str(v: unknown, max = 500): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function normalizePlace(raw: RawPlace, placeId: string): PlaceSnapshot {
  const hours = Array.isArray(raw.regularOpeningHours?.weekdayDescriptions)
    ? raw.regularOpeningHours!.weekdayDescriptions!.filter((d): d is string => typeof d === "string").slice(0, 7).map((d) => d.slice(0, 120))
    : [];
  const website = str(raw.websiteUri, 2000);
  return {
    placeId: str(raw.id, 300) ?? placeId,
    name: str(raw.displayName?.text, 300),
    address: str(raw.formattedAddress, 500),
    phone: str(raw.nationalPhoneNumber, 50),
    internationalPhone: str(raw.internationalPhoneNumber, 50),
    website: website && /^https?:\/\//i.test(website) ? website : null,
    mapsUri: (() => {
      const u = str(raw.googleMapsUri, 2000);
      return u && /^https:\/\/(maps\.google\.com|www\.google\.com|maps\.app\.goo\.gl|goo\.gl)\//i.test(u) ? u : null;
    })(),
    rating: num(raw.rating),
    reviewCount: num(raw.userRatingCount) != null ? Math.round(raw.userRatingCount!) : null,
    businessStatus: str(raw.businessStatus, 50),
    primaryType: str(raw.primaryType, 100),
    category: str(raw.primaryTypeDisplayName?.text, 100),
    types: Array.isArray(raw.types) ? raw.types.filter((t): t is string => typeof t === "string").slice(0, 30).map((t) => t.slice(0, 80)) : [],
    hasHours: hours.length > 0 || (Array.isArray(raw.regularOpeningHours?.periods) && raw.regularOpeningHours!.periods!.length > 0),
    hours,
    photosCount: Array.isArray(raw.photos) ? Math.min(raw.photos.length, PLACES_MAX_PHOTOS) : 0,
    editorialSummary: str(raw.editorialSummary?.text, 1000),
    reviews: (Array.isArray(raw.reviews) ? raw.reviews : []).slice(0, PLACES_MAX_REVIEWS).map((r) => ({
      rating: num(r?.rating),
      text: str(r?.text?.text ?? r?.originalText?.text, 1500),
      author: str(r?.authorAttribution?.displayName, 200),
      authorUri: (() => {
        const u = str(r?.authorAttribution?.uri, 500);
        return u && /^https:\/\/(www\.)?google\.com\//i.test(u) ? u : null;
      })(),
      when: str(r?.relativePublishTimeDescription, 100),
      publishTime: str(r?.publishTime, 40),
    })),
  };
}

/** Read a stored snapshot back (JSON column); tolerant of older/partial shapes. */
export function readSnapshot(data: unknown): PlaceSnapshot | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Partial<PlaceSnapshot>;
  if (typeof d.placeId !== "string") return null;
  return {
    placeId: d.placeId,
    name: d.name ?? null,
    address: d.address ?? null,
    phone: d.phone ?? null,
    internationalPhone: d.internationalPhone ?? null,
    website: d.website ?? null,
    mapsUri: d.mapsUri ?? null,
    rating: d.rating ?? null,
    reviewCount: d.reviewCount ?? null,
    businessStatus: d.businessStatus ?? null,
    primaryType: d.primaryType ?? null,
    category: d.category ?? null,
    types: Array.isArray(d.types) ? d.types : [],
    hasHours: Boolean(d.hasHours),
    hours: Array.isArray(d.hours) ? d.hours : [],
    photosCount: typeof d.photosCount === "number" ? d.photosCount : 0,
    editorialSummary: d.editorialSummary ?? null,
    reviews: Array.isArray(d.reviews) ? d.reviews : [],
  };
}
