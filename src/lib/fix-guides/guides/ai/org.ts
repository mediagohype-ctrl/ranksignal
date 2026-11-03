// Business info for Google and AI (Organization / LocalBusiness), per platform. Shared by "AI can identify your
// business" and "Business info for Google and AI + logo".
import type { Platform } from "@/lib/platform/detect";
import type { FixGuide } from "../../types";
import { CHECK_CODE, ORG_CODE, PASTE_SITE_WIDE, PUBLISH } from "./shared";

const DETAILS =
  "Collect your details: your exact business name (spelled the same everywhere), website address, a link to a square logo image (at least 112×112 pixels), phone, address if customers visit you, and links to your official profiles.";
const START_FROM = `Start from this code and replace the parts in capitals with your details (or ask the AI prompt below to fill it in): ${ORG_CODE}`;
const LOCAL =
  "Local business (customers visit you, or you serve a town or area)? Change `Organization` to `LocalBusiness` — or a more exact type such as `Plumber`, `Dentist` or `Restaurant` — and add your `address`, `telephone` and `openingHours`.";
const CHECK_FIRST =
  "Your platform may already add some of this. Check your home page in Google's Rich Results Test (search.google.com/test/rich-results) first: if it already shows your business, complete that instead of adding a second copy.";

/** Steps to add or complete business info on one platform; `extra` is the guide's own focus (profiles, logo…). */
export function orgSteps(p: Platform, extra: string): string[] {
  switch (p) {
    case "nextjs":
      return [
        DETAILS,
        "Open `app/layout.tsx` and add a constant above the component: `const org = { \"@context\": \"https://schema.org\", \"@type\": \"Organization\", name: \"<Brand>\", url: \"https://yoursite.com\", logo: \"https://yoursite.com/logo.png\", sameAs: [\"https://www.linkedin.com/company/…\"] }`.",
        "Inside `<body>` add `<script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(org).replace(/</g, \"\\\\u003c\") }} />`. Keep it in this server file, not in a `\"use client\"` component.",
        extra,
        LOCAL,
        PUBLISH.nextjs,
        CHECK_CODE,
      ];
    case "react":
      return [DETAILS, START_FROM, ...PASTE_SITE_WIDE.react, extra, LOCAL, PUBLISH.react, CHECK_CODE];
    case "wordpress":
      return [
        "Install Yoast SEO or Rank Math if you don't have one (Plugins → Add New Plugin → search → Install → Activate).",
        "Yoast: go to Yoast SEO → Settings → Site representation → choose \"Organization\", type your exact business name (\"<Brand>\") and upload a square logo (at least 112×112 pixels).",
        "On the same screen, under \"Other profiles\", add the links to your official profiles. Click Save changes.",
        "Rank Math instead: Rank Math → Titles & Meta → Local SEO → choose Company, enter the name and logo; add profile links under Titles & Meta → Social Meta.",
        extra,
        "Local business: Rank Math's Local SEO section (business type, address, phone, opening hours) or the paid Yoast Local SEO add-on adds your address too.",
        CHECK_CODE,
      ];
    case "shopify":
      return [
        CHECK_FIRST,
        START_FROM,
        ...PASTE_SITE_WIDE.shopify,
        extra,
        "Keep it matching your store: set the logo in Online Store → Themes → Customize → Header, and the name in Settings → Store details.",
        CHECK_CODE,
      ];
    case "wix":
      return [
        "Fill in your dashboard's Settings → Business Info (name, logo, address, phone). Wix uses it for your business details.",
        CHECK_FIRST,
        "To add your profile links: Pages & Menu → hover your Home page → ⋯ → SEO basics → Advanced SEO → Structured data markup → + Add New Markup.",
        START_FROM + " If Wix shows an error about the `<script>` tags, remove them and paste only the part from the first `{` to the last `}`.",
        extra,
        PUBLISH.wix,
        CHECK_CODE,
      ];
    case "webflow":
      return [DETAILS, START_FROM, ...PASTE_SITE_WIDE.webflow, extra, LOCAL, CHECK_CODE];
    case "framer":
      return [DETAILS, START_FROM, ...PASTE_SITE_WIDE.framer, extra, LOCAL, CHECK_CODE];
    case "squarespace":
      return [
        "Fill in Settings → Business information (name, address, phone, hours) and set your logo in the site header — Squarespace adds basic business info from these automatically.",
        "That automatic info doesn't include your profile links, so add them with code (use exactly the same business name):",
        START_FROM,
        ...PASTE_SITE_WIDE.squarespace,
        extra,
        CHECK_CODE,
      ];
    case "custom":
      return [DETAILS, `Add this to the \`<head>\` of your shared template: ${ORG_CODE}`, extra, LOCAL, CHECK_CODE];
  }
}

export const ORG_HINTS: FixGuide["promptHints"] = {
  nextjs:
    "Add Organization JSON-LD (or a LocalBusiness subtype if the business serves customers locally: address as PostalAddress, telephone, openingHoursSpecification) in app/layout.tsx as a server-rendered <script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(org).replace(/</g, \"\\u003c\") }} />. Include @id (site URL + '#organization'), name (exact brand name), url, logo (absolute URL, square, ≥112×112), sameAs (official profile URLs: LinkedIn, Facebook, Instagram, YouTube, X, Google Business Profile, Crunchbase, Wikidata/Wikipedia if any) and contactPoint. Use clearly marked placeholders for any URL you don't know — never invent profiles.",
  react:
    "Add Organization (or LocalBusiness) JSON-LD statically inside <head> in index.html with @id, name, url, logo, sameAs (official profiles) and contact details. Placeholders for unknown URLs; never invent profiles.",
  custom:
    "Add Organization (or LocalBusiness) JSON-LD to the shared <head> template with @id, name, url, logo, sameAs (official profiles) and contact details. Placeholders for unknown URLs; never invent profiles.",
};
