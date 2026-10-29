// Off-site tracker: shared types, labels, validation and the curated starter list. Pure (client-safe, no db).
import { z } from "zod";

export const OFFSITE_TYPES = [
  "directory",
  "review_platform",
  "pr_mention",
  "forum_thread",
  "wikidata",
  "social_profile",
  "best_list",
  "other",
] as const;
export type OffsiteType = (typeof OFFSITE_TYPES)[number];

export const OFFSITE_STATUSES = ["todo", "submitted", "live", "rejected"] as const;
export type OffsiteStatus = (typeof OFFSITE_STATUSES)[number];

export const OFFSITE_SOURCES = ["manual", "ai_citation"] as const;
export type OffsiteSource = (typeof OFFSITE_SOURCES)[number];

export const TYPE_LABEL: Record<OffsiteType, string> = {
  directory: "Directory listing",
  review_platform: "Review platform",
  pr_mention: "PR / press mention",
  forum_thread: "Forum or community",
  wikidata: "Entity profile (Wikidata etc.)",
  social_profile: "Business / social profile",
  best_list: "“Best of” list or article",
  other: "Other",
};

export const STATUS_LABEL: Record<OffsiteStatus, string> = {
  todo: "To do",
  submitted: "Submitted",
  live: "Live",
  rejected: "Rejected",
};

/** Allowed pipeline moves: todo → submitted → live | rejected (and back, to correct mistakes or resubmit). */
export const NEXT_STATUSES: Record<OffsiteStatus, OffsiteStatus[]> = {
  todo: ["submitted", "live", "rejected"],
  submitted: ["live", "rejected", "todo"],
  live: ["submitted", "rejected"],
  rejected: ["todo", "submitted"],
};

export const asType = (v: unknown): OffsiteType => (OFFSITE_TYPES.includes(v as OffsiteType) ? (v as OffsiteType) : "other");
export const asStatus = (v: unknown): OffsiteStatus => (OFFSITE_STATUSES.includes(v as OffsiteStatus) ? (v as OffsiteStatus) : "todo");
export const asSource = (v: unknown): OffsiteSource => (v === "ai_citation" ? "ai_citation" : "manual");

/** Client-facing row (dates as ISO strings). */
export interface OffsiteItemView {
  id: string;
  projectId: string;
  type: OffsiteType;
  name: string;
  url: string | null;
  status: OffsiteStatus;
  napConsistent: boolean | null;
  source: OffsiteSource;
  taskId: string | null;
  notes: string | null;
  liveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------------------------------------------ validation

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Must start with http:// or https://");
const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const offsiteCreateSchema = z
  .object({
    type: z.enum(OFFSITE_TYPES),
    name: z.string().trim().min(1, "Add a name").max(200),
    url: z.preprocess(blankToNull, httpUrl.nullable().optional()),
    status: z.enum(OFFSITE_STATUSES).optional(),
    napConsistent: z.boolean().nullable().optional(),
    source: z.enum(OFFSITE_SOURCES).optional(),
    notes: z.preprocess(blankToNull, z.string().trim().max(2000).nullable().optional()),
    liveAt: z.preprocess(blankToNull, z.coerce.date().nullable().optional()),
  })
  .strict();
export type OffsiteCreateInput = z.infer<typeof offsiteCreateSchema>;

export const offsiteUpdateSchema = offsiteCreateSchema.omit({ source: true }).partial().strict();
export type OffsiteUpdateInput = z.infer<typeof offsiteUpdateSchema>;

export const offsiteFilterSchema = z.object({
  status: z.enum(OFFSITE_STATUSES).optional(),
  type: z.enum(OFFSITE_TYPES).optional(),
  q: z.string().trim().max(100).optional(),
});
export type OffsiteFilters = z.infer<typeof offsiteFilterSchema>;

// ------------------------------------------------------------------------------------------------ starter list

export type StarterCategory = "local" | "maps" | "b2b" | "software_reviews" | "reviews" | "entity" | "social";

export interface StarterListing {
  key: string;
  name: string;
  domain: string;
  url: string;
  type: OffsiteType;
  categories: StarterCategory[];
  note: string;
}

/**
 * Curated starter list for Indian businesses. These are common places people (and AI assistants) look a business up —
 * suggestions to consider, not guarantees that a listing will be cited or improve visibility.
 */
export const STARTER_LISTINGS: StarterListing[] = [
  { key: "gbp", name: "Google Business Profile", domain: "business.google.com", url: "https://business.google.com/", type: "directory", categories: ["local", "maps"], note: "Shows in Google Search and Maps for local searches." },
  { key: "justdial", name: "Justdial", domain: "justdial.com", url: "https://www.justdial.com/", type: "directory", categories: ["local"], note: "Large Indian local directory." },
  { key: "indiamart", name: "IndiaMART", domain: "indiamart.com", url: "https://seller.indiamart.com/", type: "directory", categories: ["b2b"], note: "B2B marketplace for manufacturers, suppliers and traders." },
  { key: "sulekha", name: "Sulekha", domain: "sulekha.com", url: "https://www.sulekha.com/", type: "directory", categories: ["local"], note: "Local services marketplace in Indian cities." },
  { key: "bing_places", name: "Bing Places", domain: "bingplaces.com", url: "https://www.bingplaces.com/", type: "directory", categories: ["local", "maps"], note: "Business listing for Bing and Bing Maps." },
  { key: "apple_bc", name: "Apple Business Connect", domain: "businessconnect.apple.com", url: "https://businessconnect.apple.com/", type: "directory", categories: ["local", "maps"], note: "Your place card in Apple Maps." },
  { key: "linkedin", name: "LinkedIn company page", domain: "linkedin.com", url: "https://www.linkedin.com/company/setup/new/", type: "social_profile", categories: ["social", "entity", "b2b"], note: "Company profile with your official name, site and description." },
  { key: "crunchbase", name: "Crunchbase", domain: "crunchbase.com", url: "https://www.crunchbase.com/", type: "wikidata", categories: ["entity", "b2b"], note: "Company profile often used as a reference for basic company facts." },
  { key: "g2", name: "G2", domain: "g2.com", url: "https://sell.g2.com/", type: "review_platform", categories: ["software_reviews", "b2b"], note: "Software reviews and category comparisons." },
  { key: "capterra", name: "Capterra", domain: "capterra.com", url: "https://www.capterra.com/vendors/", type: "review_platform", categories: ["software_reviews", "b2b"], note: "Software directory with user reviews." },
  { key: "trustpilot", name: "Trustpilot", domain: "trustpilot.com", url: "https://business.trustpilot.com/", type: "review_platform", categories: ["reviews"], note: "Public customer reviews for any business." },
];

export const STARTER_CATEGORY_LABEL: Record<StarterCategory, string> = {
  local: "Local business",
  maps: "Maps",
  b2b: "B2B",
  software_reviews: "Software reviews",
  reviews: "Reviews",
  entity: "Company facts",
  social: "Profiles",
};
