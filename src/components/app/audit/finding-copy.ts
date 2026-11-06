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
    why: "If our website check can't open it, Google and AI assistants probably can't either.",
    fix: "Check the page opens in a browser and isn't blocked by a firewall or login.",
  },
  server_error: {
    title: "Page shows an error",
    why: "Visitors and Google see a broken page, and repeated errors can drop it from Google.",
    fix: "Ask your web developer or web host to look into the error on this page.",
  },
  client_error: {
    title: "Page not found",
    why: "Links to this page lead to a dead end, which loses visitors and wastes Google's time on your site.",
    fix: "Bring the page back, or send visitors to the closest working page. For your web developer: add a 301 redirect.",
  },
  non_200_status: {
    title: "Page doesn't load normally",
    why: "Pages that don't load normally may not appear on Google or in AI answers.",
    fix: "Ask your web developer to make the page load normally. For your web developer: return status 200.",
  },
  redirect_chain: {
    title: "Visitors are forwarded several times",
    why: "Each extra hop slows the page down and can make Google give up before reaching it.",
    fix: "Point links straight to the final address.",
  },
  missing_title: {
    title: "Google headline missing",
    why: "This is the blue clickable line in Google. Without one, Google guesses.",
    fix: "Add a short headline that names the page topic and your business. For your web developer: set the <title> tag.",
  },
  title_too_long: {
    title: "Google headline too long — Google cuts it off",
    why: "The cut-off part may be what tells people what you offer.",
    fix: "Keep it under about 60 characters, with the key words first.",
  },
  title_too_short: {
    title: "Google headline too short",
    why: "A very short headline gives people little reason to click.",
    fix: "Make it say what the page is about and who it's for.",
  },
  missing_meta_description: {
    title: "Google summary missing — Google shows random text instead",
    why: "This is the short text under your link in Google. A clear one wins more clicks.",
    fix: "Write a one- or two-sentence summary of the page (about 150 characters). For your web developer: add a <meta name=\"description\"> tag.",
  },
  meta_description_too_long: {
    title: "Google summary too long — Google cuts it off",
    why: "Long summaries get cut off mid-sentence in Google.",
    fix: "Trim it to about 150–160 characters with the main point first.",
  },
  missing_h1: {
    title: "Main heading missing",
    why: "The main heading tells visitors and AI assistants what the page is about at a glance.",
    fix: "Add one clear main heading at the top of the page. For your web developer: use one <h1>.",
  },
  multiple_h1: {
    title: "More than one main heading",
    why: "Several main headings make it less clear what the page is really about.",
    fix: "Keep one main heading and turn the others into subheadings.",
  },
  heading_level_skip: {
    title: "Headings jump levels",
    why: "Jumping from a big heading to a much smaller one makes the page harder to follow for screen readers, Google and AI.",
    fix: "Use headings in order: Heading 1, then Heading 2, then Heading 3.",
  },
  missing_canonical: {
    title: "Main version of the page not set",
    why: "Without it, Google may treat copies of the page as separate pages and split their credit.",
    fix: "Most website plugins set this for you. For your web developer: add a canonical link to the page's own address.",
  },
  canonical_other_host: {
    title: "Page says another website has the main version",
    why: "This tells Google the 'real' page lives elsewhere, so this one may not be shown.",
    fix: "Point it back to this page's own address, unless the copy is on purpose. For your web developer: fix the canonical link.",
  },
  noindex: {
    title: "Page is hidden from Google",
    why: "A setting on the page asks Google not to show it at all.",
    fix: "Switch the setting off if you want this page to be found. For your web developer: remove the noindex tag.",
  },
  missing_lang: {
    title: "Page language not set",
    why: "Setting the language helps Google, translators and screen readers handle the page correctly.",
    fix: "Set your site language in your website settings. For your web developer: add lang=\"en\" (or your language) to the <html> tag.",
  },
  images_missing_alt: {
    title: "Image description missing",
    why: "Image descriptions let Google, AI and blind visitors understand your pictures.",
    fix: "Add a short description to each meaningful image.",
  },
  thin_content: {
    title: "Very little text on the page",
    why: "Pages with only a few words rarely answer questions well enough to be shown or quoted.",
    fix: "Add helpful detail: what it is, who it's for, prices, common questions.",
  },
  invalid_json_ld: {
    title: "Info for Google and AI is broken",
    why: "This hidden info helps Google and AI understand your business; broken info is simply ignored.",
    fix: "Ask your web developer to fix it. For your web developer: make the JSON-LD block valid (test it with a schema validator).",
  },
  question_page_without_faq_schema: {
    title: "Questions on the page aren't labelled for Google and AI",
    why: "Labelling your questions and answers makes them easier for Google and AI assistants to pick up.",
    fix: "Add info for Google and AI for the questions on this page. For your web developer: add FAQPage structured data.",
  },
  duplicate_title: {
    title: "Same Google headline on several pages",
    why: "Identical headlines make your pages compete with each other and confuse searchers.",
    fix: "Give each page its own headline that describes what's on it.",
  },
  duplicate_meta_description: {
    title: "Same Google summary on several pages",
    why: "Repeated summaries make your results in Google look identical and less clickable.",
    fix: "Write a different summary for each page.",
  },
  duplicate_content: {
    title: "Pages with the same text",
    why: "Google usually shows only one copy, and may not pick the one you want.",
    fix: "Merge the pages, rewrite one, or mark which is the main version of the page.",
  },
  broken_internal_link: {
    title: "Links to pages that don't work",
    why: "Broken links frustrate visitors and stop Google from reaching the rest of your site.",
    fix: "Update or remove links that point to the broken page.",
  },
  no_sitemap: {
    title: "No page list for Google",
    why: "A sitemap is a list of your pages that helps Google find everything quickly.",
    fix: "Most website plugins can create one. For your web developer: publish sitemap.xml and list it in robots.txt.",
  },
  ai_crawler_access: {
    title: "Some AI assistants are blocked",
    why: "If AI robots can't read your site, assistants like ChatGPT may know less about your business.",
    fix: "Decide which AI robots you're happy to allow. For your web developer: update the rules in robots.txt.",
  },
  missing_organization_schema: {
    title: "Business details aren't set up for Google and AI",
    why: "This hidden info tells Google and AI your official name, logo and contact details.",
    fix: "Add business info for Google and AI to your home page. For your web developer: add Organization (or LocalBusiness) structured data.",
  },
  no_structured_data: {
    title: "No info for Google and AI on the site",
    why: "This hidden summary helps Google and AI read your pages; without it, they must guess.",
    fix: "Start with your business details on the home page and add more over time.",
  },
  no_llms_txt: {
    title: "No AI guide file",
    why: "An AI guide file is a new, optional list of your key pages for AI assistants. It's not required.",
    fix: "Optionally publish one listing your most important pages. For your web developer: publish /llms.txt.",
  },
};

export function findingCopy(code: string, fallbackMessage: string): FindingCopy {
  return (
    COPY[code] ?? {
      title: fallbackMessage,
      why: "Our website check found this. It may hold the page back.",
      fix: "Look at the details below and decide whether it needs a change.",
    }
  );
}

export const CATEGORY_LABEL: Record<string, string> = {
  technical: "Website setup",
  content: "Page content",
  metadata: "Google headline & summary",
  schema: "Info for Google and AI",
  indexability: "Can appear on Google",
  links: "Links",
  ai_readiness: "GEO",
};

export function categoryLabel(c: string): string {
  return CATEGORY_LABEL[c] ?? c.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());
}

export const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

/** Severity groups shown to people (docs/PLAIN_WORDS.md): critical/high → Urgent, medium → Important, low/info → Nice to have. */
export type Priority = "urgent" | "important" | "nice";
export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "important", label: "Important" },
  { value: "nice", label: "Nice to have" },
];
export function priorityOf(severity: string): Priority {
  return severity === "critical" || severity === "high" ? "urgent" : severity === "medium" ? "important" : "nice";
}
