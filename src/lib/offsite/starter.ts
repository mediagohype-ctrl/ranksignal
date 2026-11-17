// Starter listings by what the business is (pure, client-safe). A marketing agency and an online store should not
// be offered software review sites (G2, Capterra); each kind of business gets the places its customers really look.
import { STARTER_LISTINGS, type StarterListing } from "./types";

export type BusinessKind = "online_store" | "agency" | "software" | "local" | "default";

export const BUSINESS_KIND_LABEL: Record<BusinessKind, string> = {
  online_store: "online stores",
  agency: "agencies and service businesses",
  software: "software businesses",
  local: "local businesses",
  default: "businesses in India",
};

/** Starter list per kind of business, in the order shown. Keys refer to STARTER_LISTINGS. */
export const STARTER_KEYS: Record<BusinessKind, string[]> = {
  online_store: ["gbp", "amazon", "flipkart", "meesho", "instagram_shop", "facebook", "youtube"],
  agency: ["gbp", "clutch", "goodfirms", "designrush", "linkedin", "justdial"],
  software: ["g2", "capterra", "producthunt", "linkedin"],
  local: ["gbp", "justdial", "sulekha", "facebook", "instagram"],
  default: ["gbp", "linkedin", "justdial", "indiamart", "facebook"],
};

export interface BusinessSignals {
  /** "What you sell" from setup (and the project's categories). */
  sells?: string | null;
  /** "Who your customers are" from setup. */
  customers?: string | null;
  city?: string | null;
  /** Detected website platform: shopify, wix, wordpress, … */
  platform?: string | null;
  keywords?: string[];
}

const SOFTWARE = /\b(software|saas|apps?|platform|plugins?|extensions?|api|crm|erp|dashboard|chatbot|ai tools?|web tools?|online tools?|automation tool|browser extension)\b/i;
const AGENCY =
  /\b(agency|agencies|consult(?:ant|ants|ing|ancy)|marketing|seo|branding|advertising|web ?design|website design|web development|app development|software development|development company|design studio|outsourc\w*|recruit\w*|staffing|video production|public relations|content writing|copywriting|it services)\b/i;
const STORE =
  /\b(online (?:store|shop)|e-?commerce|d2c|buy online|shop online|free shipping|cash on delivery|we (?:sell|ship|deliver)|products? (?:for|like)|apparel|clothing|fashion|jewell?ery|footwear|shoes|cosmetics|skincare|gadgets?|accessories|home decor|furniture|toys|gifts|kitchenware|bottles?|bags|watches|electronics)\b/i;
const LOCAL =
  /\b(shops?|clinics?|salons?|spas?|restaurants?|caf[eé]s?|bakery|bakeries|plumb(?:er|ers|ing)|electricians?|dentists?|dental|doctors?|hospitals?|gyms?|repairs?|cleaning|laundry|tutors?|tuition|coaching|hotels?|florists?|pharmacy|pharmacies|mechanics?|garages?|boutiques?|showrooms?|caterers?|catering|physio(?:therapy)?|vets?|veterinary|barbers?|movers|packers|near me|local)\b/i;

/** Website builders that are (almost always) online stores. */
const STORE_PLATFORMS = new Set(["shopify", "woocommerce", "bigcommerce", "magento"]);

/** What kind of business this is, from what setup already knows. Order matters: the strongest signal wins. */
export function businessKind(s: BusinessSignals): BusinessKind {
  const text = [s.sells, ...(s.keywords ?? [])].filter(Boolean).join(" ");
  const platform = (s.platform ?? "").toLowerCase();
  if (STORE_PLATFORMS.has(platform)) return "online_store";
  if (AGENCY.test(text)) return "agency";
  if (SOFTWARE.test(text)) return "software";
  if (STORE.test(text)) return "online_store";
  if (LOCAL.test(text)) return "local";
  return "default";
}

const byKey = new Map(STARTER_LISTINGS.map((l) => [l.key, l]));

/** The starter listings for one kind of business, in order. */
export function starterListingsFor(kind: BusinessKind): StarterListing[] {
  return STARTER_KEYS[kind].map((k) => byKey.get(k)).filter((l): l is StarterListing => !!l);
}
