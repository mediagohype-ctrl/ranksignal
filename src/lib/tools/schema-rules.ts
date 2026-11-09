// Field lists for the schema markup checker, one entry per common schema.org type, taken from Google Search
// Central's structured data docs (linked per rule). "required" = Google lists it as required for the rich result;
// "recommended" = Google lists it as recommended. Review these against the linked docs when Google changes them.
// Valid markup only makes a page ELIGIBLE for rich results; Google never guarantees them.

export interface SchemaRule {
  /** Rule key and label. */
  key: string;
  label: string;
  /** schema.org types this rule applies to (exact @type match, without the schema.org prefix). */
  types: string[];
  /** Google Search Central documentation for this type. */
  docUrl: string;
  required: string[];
  /** Each inner list: at least ONE of these fields is required (e.g. Product needs offers, review or aggregateRating). */
  requiredOneOf?: string[][];
  /** Required only when the node is top-level (not nested inside another item that it describes). */
  requiredWhenTopLevel?: string[];
  recommended: string[];
  /** Only check this type when it sits inside one of these types (e.g. ListItem inside BreadcrumbList). */
  onlyInside?: string[];
  /** Plain-English note shown with the result. */
  note?: string;
}

const DOCS = "https://developers.google.com/search/docs/appearance/structured-data";

/** Common LocalBusiness subtypes (the Organization rule covers the rest via ORG-like names). */
export const LOCAL_BUSINESS_TYPES = [
  "LocalBusiness", "Restaurant", "Store", "Dentist", "Physician", "MedicalClinic", "Plumber", "Electrician", "Locksmith",
  "RoofingContractor", "HVACBusiness", "GeneralContractor", "HousePainter", "MovingCompany", "AutoRepair", "AutoDealer",
  "BeautySalon", "HairSalon", "NailSalon", "DaySpa", "HealthClub", "Bakery", "CafeOrCoffeeShop", "BarOrPub",
  "FoodEstablishment", "Hotel", "LodgingBusiness", "LegalService", "Attorney", "AccountingService", "FinancialService",
  "InsuranceAgency", "RealEstateAgent", "TravelAgency", "ProfessionalService", "HomeAndConstructionBusiness",
  "ChildCare", "Florist", "Optician", "Pharmacy", "VeterinaryCare", "ClothingStore", "ElectronicsStore", "GroceryStore",
];

export const SCHEMA_RULES: SchemaRule[] = [
  {
    key: "Organization",
    label: "Organization",
    types: ["Organization", "Corporation", "NGO", "OnlineStore", "OnlineBusiness", "EducationalOrganization", "MedicalOrganization", "NewsMediaOrganization"],
    docUrl: `${DOCS}/organization`,
    required: [],
    recommended: ["name", "url", "logo", "sameAs", "description", "address", "telephone", "email", "contactPoint"],
    note: "Google has no required fields here; the more of these you fill in, the easier it is to connect your site to your business.",
  },
  {
    key: "LocalBusiness",
    label: "Local business",
    types: LOCAL_BUSINESS_TYPES,
    docUrl: `${DOCS}/local-business`,
    required: ["name", "address"],
    recommended: ["url", "telephone", "geo", "openingHoursSpecification", "priceRange", "aggregateRating", "review"],
  },
  {
    key: "Product",
    label: "Product",
    types: ["Product", "ProductGroup"],
    docUrl: `${DOCS}/product-snippet`,
    required: ["name"],
    requiredOneOf: [["offers", "review", "aggregateRating"]],
    recommended: ["image", "description", "brand", "sku", "offers.price", "offers.priceCurrency", "offers.availability"],
  },
  {
    key: "Article",
    label: "Article / blog post",
    types: ["Article", "NewsArticle", "BlogPosting"],
    docUrl: `${DOCS}/article`,
    required: [],
    recommended: ["headline", "image", "datePublished", "dateModified", "author", "author.name"],
    note: "Google lists no required fields for articles; headline, image, dates and author are recommended.",
  },
  {
    key: "FAQPage",
    label: "FAQ page",
    types: ["FAQPage"],
    docUrl: `${DOCS}/faqpage`,
    required: ["mainEntity"],
    recommended: [],
    note: "Since August 2023 Google shows FAQ rich results mainly for well-known government and health websites. The markup still labels your questions and answers clearly for search and AI tools.",
  },
  {
    key: "Question",
    label: "FAQ question",
    types: ["Question"],
    docUrl: `${DOCS}/faqpage`,
    required: ["name", "acceptedAnswer", "acceptedAnswer.text"],
    recommended: [],
    onlyInside: ["FAQPage"],
  },
  {
    key: "BreadcrumbList",
    label: "Breadcrumbs",
    types: ["BreadcrumbList"],
    docUrl: `${DOCS}/breadcrumb`,
    required: ["itemListElement"],
    recommended: [],
  },
  {
    key: "ListItem",
    label: "Breadcrumb step",
    types: ["ListItem"],
    docUrl: `${DOCS}/breadcrumb`,
    required: ["position", "name"],
    recommended: ["item"],
    onlyInside: ["BreadcrumbList"],
    note: "Every step except the last one should also have an item (the address of that step).",
  },
  {
    key: "WebSite",
    label: "Website (site name)",
    types: ["WebSite"],
    docUrl: "https://developers.google.com/search/docs/appearance/site-names",
    required: ["name", "url"],
    recommended: ["alternateName"],
    note: "Put this on your home page only. It helps Google show your preferred site name.",
  },
  {
    key: "Review",
    label: "Review",
    types: ["Review", "CriticReview"],
    docUrl: `${DOCS}/review-snippet`,
    required: ["author", "reviewRating", "reviewRating.ratingValue"],
    requiredWhenTopLevel: ["itemReviewed"],
    recommended: ["datePublished", "reviewRating.bestRating"],
    note: "Google does not show review stars for reviews a business writes about itself (self-serving reviews) on LocalBusiness or Organization.",
  },
  {
    key: "AggregateRating",
    label: "Rating summary",
    types: ["AggregateRating"],
    docUrl: `${DOCS}/review-snippet`,
    required: ["ratingValue"],
    requiredOneOf: [["ratingCount", "reviewCount"]],
    requiredWhenTopLevel: ["itemReviewed"],
    recommended: ["bestRating", "worstRating"],
  },
  {
    key: "Event",
    label: "Event",
    types: ["Event", "MusicEvent", "BusinessEvent", "EducationEvent", "SportsEvent", "TheaterEvent", "Festival", "SocialEvent", "ExhibitionEvent", "FoodEvent"],
    docUrl: `${DOCS}/event`,
    required: ["name", "startDate", "location"],
    recommended: ["description", "endDate", "eventStatus", "eventAttendanceMode", "image", "offers", "organizer", "performer"],
  },
  {
    key: "HowTo",
    label: "How-to",
    types: ["HowTo"],
    docUrl: "https://developers.google.com/search/blog/2023/08/howto-faq-changes",
    required: ["name", "step"],
    recommended: ["image", "totalTime", "supply", "tool"],
    note: "Google stopped showing How-to rich results in 2023. The markup is still valid schema.org and can help other tools read your steps.",
  },
];

const BY_TYPE = new Map<string, SchemaRule>();
for (const r of SCHEMA_RULES) for (const t of r.types) BY_TYPE.set(t, r);

/** The rule for a schema.org type, or undefined when we don't check that type. */
export function ruleForType(type: string): SchemaRule | undefined {
  return BY_TYPE.get(type.replace(/^https?:\/\/schema\.org\//, ""));
}
