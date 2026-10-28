// Plain-English copy for audit rule codes (see src/lib/audit/rules.ts). Unknown codes fall back to the
// finding's own message, so new rules still render sensibly.
export interface FindingCopy {
  /** Short, plain-English name of the problem. */
  title: string;
  /** One line: why a business owner should care. */
  why: string;
  /** One line: what to do about it. */
  fix: string;
}

const COPY: Record<string, FindingCopy> = {
  fetch_failed: {
    title: "We couldn't load this page",
    why: "If our crawler can't open it, search engines and AI assistants probably can't either.",
    fix: "Check the page opens in a browser and isn't blocked by a firewall or login.",
  },
  server_error: {
    title: "Page shows a server error",
    why: "Visitors and search engines see a broken page, and repeated errors can drop it from results.",
    fix: "Ask your developer or host to check the server logs for this URL.",
  },
  client_error: {
    title: "Page not found or not allowed",
    why: "Links to this page lead to a dead end, which wastes visitors and search engine attention.",
    fix: "Restore the page, or redirect it to the closest working page.",
  },
  non_200_status: {
    title: "Page doesn't load normally",
    why: "Pages that don't return a normal 'OK' response may not be shown in search or AI answers.",
    fix: "Make sure the page returns a normal response (status 200).",
  },
  redirect_chain: {
    title: "Too many redirects in a row",
    why: "Each extra hop slows the page down and can make search engines give up before reaching it.",
    fix: "Point links and redirects straight to the final address.",
  },
  missing_title: {
    title: "Page has no title",
    why: "The title is the clickable headline in search results — without one, search engines guess.",
    fix: "Add a short, descriptive title that names the page topic and your brand.",
  },
  title_too_long: {
    title: "Page title is too long",
    why: "Long titles get cut off in search results, hiding the part that tells people what you offer.",
    fix: "Keep titles under about 60 characters, with the key words first.",
  },
  title_too_short: {
    title: "Page title is too short",
    why: "A very short title gives search engines and shoppers little reason to click.",
    fix: "Expand it to say what the page is about and who it's for.",
  },
  missing_meta_description: {
    title: "No search snippet (meta description)",
    why: "This is the short summary under your link in search results. Without it, search engines pick random text.",
    fix: "Write a one- or two-sentence summary of the page (about 150 characters).",
  },
  meta_description_too_long: {
    title: "Search snippet is too long",
    why: "Long descriptions get cut off mid-sentence in search results.",
    fix: "Trim it to about 150–160 characters with the main point first.",
  },
  missing_h1: {
    title: "Page has no main heading",
    why: "The main heading (H1) tells readers and AI assistants what the page is about at a glance.",
    fix: "Add one clear main heading at the top of the page.",
  },
  multiple_h1: {
    title: "More than one main heading",
    why: "Several main headings make it less clear what the page is really about.",
    fix: "Keep a single main heading and turn the others into subheadings.",
  },
  heading_level_skip: {
    title: "Headings skip levels",
    why: "Jumping from a big heading to a much smaller one makes the page outline harder to follow for screen readers and machines.",
    fix: "Use headings in order (H1, then H2, then H3).",
  },
  missing_canonical: {
    title: "No preferred address (canonical) set",
    why: "Without it, search engines may treat copies of the page as separate pages and split their credit.",
    fix: "Add a canonical link pointing to the main address of this page.",
  },
  canonical_other_host: {
    title: "Preferred address points to another site",
    why: "This tells search engines the 'real' page lives elsewhere, so this one may not be shown.",
    fix: "Point the canonical link to this page's own address unless the copy is intentional.",
  },
  noindex: {
    title: "Page is hidden from search engines",
    why: "A 'noindex' tag asks search engines not to show this page at all.",
    fix: "Remove the noindex tag if you want this page to be found.",
  },
  missing_lang: {
    title: "Page language not declared",
    why: "Declaring the language helps search engines, translators and screen readers handle the page correctly.",
    fix: "Add a lang attribute to the page, e.g. lang=\"en\".",
  },
  images_missing_alt: {
    title: "Images without descriptions (alt text)",
    why: "Alt text lets search engines, AI and visually impaired visitors understand your images.",
    fix: "Add a short description to each meaningful image.",
  },
  thin_content: {
    title: "Very little text on the page",
    why: "Pages with only a few words rarely answer questions well enough to be shown or quoted.",
    fix: "Add helpful detail: what it is, who it's for, prices, FAQs.",
  },
  invalid_json_ld: {
    title: "Broken structured data",
    why: "Structured data helps machines understand your business; broken code is simply ignored.",
    fix: "Fix the JSON-LD block so it is valid (test it with a schema validator).",
  },
  question_page_without_faq_schema: {
    title: "Questions on the page aren't marked up as FAQs",
    why: "FAQ markup makes it easier for search engines and AI assistants to pick up your answers.",
    fix: "Add FAQ structured data for the questions and answers on this page.",
  },
  duplicate_title: {
    title: "Same title used on several pages",
    why: "Identical titles make pages compete with each other and confuse searchers.",
    fix: "Give each page its own title that describes its unique content.",
  },
  duplicate_meta_description: {
    title: "Same search snippet on several pages",
    why: "Repeated descriptions make your search results look identical and less clickable.",
    fix: "Write a unique description for each page.",
  },
  duplicate_content: {
    title: "Pages with the same text",
    why: "Search engines usually show only one copy, and may not pick the one you want.",
    fix: "Merge the pages, rewrite one, or set a canonical link to the main version.",
  },
  broken_internal_link: {
    title: "Links to pages that don't work",
    why: "Broken links frustrate visitors and stop search engines from reaching the rest of your site.",
    fix: "Update or remove links that point to the broken page.",
  },
  no_sitemap: {
    title: "No sitemap found",
    why: "A sitemap is a list of your pages that helps search engines find everything quickly.",
    fix: "Publish a sitemap.xml and mention it in robots.txt.",
  },
  ai_crawler_access: {
    title: "Some AI assistants are blocked",
    why: "If AI crawlers can't read your site, assistants like ChatGPT may know less about your business.",
    fix: "Review robots.txt and allow the AI crawlers you're comfortable with.",
  },
  missing_organization_schema: {
    title: "Business details aren't marked up",
    why: "Organization markup tells search engines and AI your official name, logo and contact details.",
    fix: "Add Organization (or LocalBusiness) structured data to your home page.",
  },
  no_structured_data: {
    title: "No structured data on the site",
    why: "Structured data is a machine-readable summary of your pages; without it, machines must guess.",
    fix: "Start with Organization markup on the home page and add more page types over time.",
  },
  no_llms_txt: {
    title: "No llms.txt file",
    why: "llms.txt is an emerging, optional guide for AI tools. It's not required, but can help them find key pages.",
    fix: "Optionally publish /llms.txt listing your most important pages.",
  },
};

export function findingCopy(code: string, fallbackMessage: string): FindingCopy {
  return (
    COPY[code] ?? {
      title: fallbackMessage,
      why: "Our checks flagged this as something that may hold the page back.",
      fix: "Review the evidence below and decide whether it needs a change.",
    }
  );
}

export const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  metadata: "Titles & descriptions",
  schema: "Structured data",
  indexability: "Search visibility",
  links: "Links",
  ai_readiness: "AI readiness",
};

export function categoryLabel(c: string): string {
  return CATEGORY_LABEL[c] ?? c.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());
}

export const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;
