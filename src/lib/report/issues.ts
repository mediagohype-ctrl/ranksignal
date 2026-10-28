// Turns failing/warning checks and leftover audit findings into plain-English issues for a business owner.
// Copy rules: short sentences, jargon explained, concrete steps, and never a promised outcome.
import type { IssueEffort, IssueImpact, Pillar, ReportIssue } from "@/lib/report/types";
import { MAX_AFFECTED, plural, type EvaluatedCheck, type ReportFinding } from "@/lib/report/inputs";

type Copy = Pick<ReportIssue, "title" | "whatsWrong" | "whyItMatters" | "howToFix" | "impact" | "effort"> & { relatedActionType?: string };
type CopyFn = (c: EvaluatedCheck) => Copy | null;

const n = (c: EvaluatedCheck, k: string) => {
  const v = c.facts[k];
  return typeof v === "number" ? v : 0;
};
const sev = (c: EvaluatedCheck, failImpact: IssueImpact, warnImpact: IssueImpact): IssueImpact => (c.status === "fail" ? failImpact : warnImpact);
const pages = (k: number) => plural(k, "page");

const WP_SEO_PLUGIN = "On WordPress, an SEO plugin such as Yoast SEO or Rank Math adds a field for this under each page's editor.";

const COPY: Record<string, CopyFn> = {
  "seo.indexability": (c) => ({
    title: n(c, "errors") ? `${pages(n(c, "errors") + n(c, "noindex"))} can't show up in Google` : `${pages(n(c, "noindex"))} ${n(c, "noindex") === 1 ? "is" : "are"} hidden from search engines`,
    whatsWrong: [
      n(c, "errors") ? `${pages(n(c, "errors"))} returned an error (like "page not found") or didn't load when we visited.` : "",
      n(c, "noindex") ? `${pages(n(c, "noindex"))} carry a "noindex" tag, which tells Google and others not to list them.` : "",
    ].filter(Boolean).join(" "),
    whyItMatters: "Pages that error or say \"noindex\" are left out of search results and are unlikely to be used by AI tools that rely on search indexes.",
    howToFix: [
      "Open each listed page in your browser and confirm whether it should exist.",
      "For broken pages: restore the content, or set up a 301 redirect to the closest working page.",
      "For noindex pages you want found: remove the noindex setting (WordPress: Settings → Reading → uncheck “Discourage search engines”, and check the page's SEO plugin “Allow search engines to show this page”).",
      "Leave noindex on pages you deliberately keep private, such as thank-you or login pages.",
    ],
    impact: "high",
    effort: "moderate",
    relatedActionType: "internal_task",
  }),
  "seo.redirects": (c) => ({
    title: `${pages(n(c, "chains"))} make visitors bounce through several redirects`,
    whatsWrong: `To reach ${n(c, "chains") === 1 ? "this page" : "these pages"}, browsers are sent from one address to another two or more times before arriving.`,
    whyItMatters: "Each extra hop slows the page down and search engines may stop following long chains.",
    howToFix: [
      "Update your menus and internal links to point straight at the final address.",
      "Change old redirects so they go directly to the final page in one step (on WordPress, the Redirection plugin lists them).",
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "create_redirect",
  }),
  "seo.titles": (c) => {
    const bad = n(c, "missing") + n(c, "duplicate") + n(c, "short");
    return {
      title: bad ? `Google can't tell what ${pages(bad)} ${bad === 1 ? "is" : "are"} about` : `${pages(n(c, "long"))} have titles that get cut off in Google`,
      whatsWrong: [
        n(c, "missing") ? `${pages(n(c, "missing"))} have no title.` : "",
        n(c, "duplicate") ? `${pages(n(c, "duplicate"))} share the same title as another page, so they look identical in search results.` : "",
        n(c, "short") ? `${pages(n(c, "short"))} have very short titles that don't describe the page.` : "",
        n(c, "long") ? `${pages(n(c, "long"))} have titles over 60 characters, which Google usually shortens with “…”.` : "",
      ].filter(Boolean).join(" ") + " The title is the blue clickable headline people see in Google.",
      whyItMatters: "The page title is one of the strongest hints search engines and AI tools use to understand a page, and it's what convinces people to click.",
      howToFix: [
        "Give every page its own title of about 50–60 characters.",
        "Put the main topic first and your brand name last, e.g. “Emergency Plumber in Pune | Acme Plumbing”.",
        WP_SEO_PLUGIN,
        "Start with your homepage and the pages that bring in customers (services, pricing).",
      ],
      impact: bad ? sev(c, "high", "medium") : "low",
      effort: "quick",
      relatedActionType: "update_title",
    };
  },
  "seo.meta_description": (c) => {
    const bad = n(c, "missing") + n(c, "duplicate");
    return {
      title: !bad
        ? `${pages(n(c, "long"))} have descriptions that get cut off`
        : n(c, "missing") === 0
          ? `${pages(bad)} share the same search description`
          : `${pages(bad)} ${bad === 1 ? "is" : "are"} missing a proper search description`,
      whatsWrong: [
        n(c, "missing") ? `${pages(n(c, "missing"))} have no meta description — the short summary shown under your link in Google.` : "",
        n(c, "duplicate") ? `${pages(n(c, "duplicate"))} reuse the same description as another page.` : "",
        n(c, "long") ? `${pages(n(c, "long"))} have descriptions over 160 characters.` : "",
      ].filter(Boolean).join(" "),
      whyItMatters: "Without one, Google picks random text from the page. A clear summary can earn more clicks, and AI tools sometimes reuse it to describe the page.",
      howToFix: [
        "Write a unique 1–2 sentence summary (120–155 characters) for each page.",
        "Say what the page offers and who it's for, and include one reason to click.",
        WP_SEO_PLUGIN,
      ],
      impact: sev(c, "medium", "medium"),
      effort: "quick",
      relatedActionType: "update_meta_description",
    };
  },
  "seo.h1": (c) => ({
    title: n(c, "missing") ? `${pages(n(c, "missing"))} have no main heading` : `${pages(n(c, "multiple"))} have more than one main heading`,
    whatsWrong: `${n(c, "missing") ? `${pages(n(c, "missing"))} have no H1 (the big headline at the top of a page). ` : ""}${n(c, "multiple") ? `${pages(n(c, "multiple"))} have several H1 headlines, which muddles what the page is mainly about.` : ""}`,
    whyItMatters: "A single clear headline helps visitors, search engines and AI tools understand the main topic quickly.",
    howToFix: [
      "Give each page one headline that states its main topic, set as “Heading 1”.",
      "Turn any other big headlines into “Heading 2” or “Heading 3”.",
      "On WordPress, the page title is usually the H1 — check your theme doesn't add a second one (e.g. the logo).",
    ],
    impact: sev(c, "medium", "low"),
    effort: "quick",
    relatedActionType: "update_content",
  }),
  "seo.canonical": (c) => ({
    title: n(c, "offsite") ? `${pages(n(c, "offsite"))} tell Google another website is the original` : `${pages(n(c, "missing"))} don't state their preferred address`,
    whatsWrong: `${n(c, "offsite") ? `${pages(n(c, "offsite"))} have a canonical tag pointing to a different website, which asks Google to credit that site instead. ` : ""}${n(c, "missing") ? `${pages(n(c, "missing"))} have no canonical tag (a hidden note saying “this is the main version of this page”).` : ""}`,
    whyItMatters: "Without it, search engines may split credit between duplicate addresses (e.g. with and without “www”) or pick the wrong one.",
    howToFix: [
      "Most SEO plugins (Yoast, Rank Math) add canonical tags automatically — make sure one is installed and active.",
      "Fix any canonical that points at another domain unless that's intentional (e.g. syndicated content).",
    ],
    impact: n(c, "offsite") ? "high" : "low",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "seo.broken_links": (c) => ({
    title: `${plural(n(c, "broken"), "link")} on your site lead${n(c, "broken") === 1 ? "s" : ""} to error pages`,
    whatsWrong: `We found ${plural(n(c, "broken"), "link")} between your own pages that end on a “page not found” or error page.`,
    whyItMatters: "Broken links frustrate visitors and waste the attention search engines give your site.",
    howToFix: [
      "Open each listed page and find links to the broken addresses.",
      "Point them at the right page, or remove them.",
      "If a page moved, add a 301 redirect from the old address to the new one.",
    ],
    impact: "medium",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "seo.internal_links": (c) => ({
    title: `${pages(n(c, "orphans"))} ${n(c, "orphans") === 1 ? "isn't" : "aren't"} linked from anywhere on your site`,
    whatsWrong: "These pages exist, but none of the other pages we checked link to them, so visitors (and search engines) struggle to find them.",
    whyItMatters: "Search engines judge how important a page is partly by how many of your own pages link to it.",
    howToFix: [
      "Add links to these pages from related pages, your menu or your footer.",
      "Use descriptive link text (“see our pricing”) rather than “click here”.",
    ],
    impact: "low",
    effort: "moderate",
    relatedActionType: "internal_task",
  }),
  "seo.image_alt": (c) => ({
    title: `${plural(n(c, "missing"), "image")} have no description`,
    whatsWrong: `${n(c, "missing")} of ${n(c, "images")} images have no “alt text” — a short written description of the picture.`,
    whyItMatters: "Alt text lets screen readers describe images to blind visitors and helps search engines understand them (and show them in image search).",
    howToFix: [
      "Describe what each image shows in a few words, e.g. “Technician repairing a water heater”.",
      "On WordPress: Media → Library → click an image → fill in “Alternative Text”.",
      "Leave alt text empty only for purely decorative images.",
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "update_image_alt",
  }),
  "seo.thin_content": (c) => ({
    title: `${pages(n(c, "thin"))} have very little text`,
    whatsWrong: `${n(c, "thin")} of ${n(c, "total")} content pages have fewer than 300 words, so they say little about what you offer.`,
    whyItMatters: "Short pages give search engines and AI tools little to understand or quote, so they're less likely to show up for the questions your customers ask.",
    howToFix: [
      "Start with your most important pages (services, products, locations).",
      "Answer the questions customers actually ask: what it is, who it's for, price range, how it works, why choose you.",
      "Add real details — examples, numbers, photos with descriptions, FAQs.",
      "Merge very similar thin pages into one stronger page.",
    ],
    impact: sev(c, "high", "medium"),
    effort: "involved",
    relatedActionType: "content_brief",
  }),
  "seo.duplicate_content": (c) => ({
    title: `${pages(n(c, "duplicates"))} are word-for-word copies of each other`,
    whatsWrong: "Some pages have exactly the same text, often from duplicate addresses or copied templates.",
    whyItMatters: "Search engines usually show only one version and may pick the wrong one; duplicates dilute your site's strength.",
    howToFix: [
      "Decide which version should be the main one.",
      "Redirect the copies to it, or point their canonical tag at it.",
      "If the pages should be different (e.g. two locations), rewrite each with its own details.",
    ],
    impact: "medium",
    effort: "moderate",
    relatedActionType: "internal_task",
  }),
  "seo.sitemap": () => ({
    title: "Your site has no sitemap for search engines",
    whatsWrong: "We couldn't find an XML sitemap — a list of your pages that search engines read to discover your content.",
    whyItMatters: "Without one, new or deep pages may take longer to be found and indexed.",
    howToFix: [
      "On WordPress, Yoast SEO or Rank Math create one automatically (usually at /sitemap_index.xml).",
      "Add a line “Sitemap: https://yourdomain/sitemap.xml” to your robots.txt.",
      "Submit it in Google Search Console and Bing Webmaster Tools.",
    ],
    impact: "medium",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "seo.https": (c) => ({
    title: c.facts.homeHttps === false ? "Your website isn't secure (no HTTPS)" : "Some visitors can still reach an insecure version of your site",
    whatsWrong: c.detail,
    whyItMatters: "Browsers warn people about insecure pages, which hurts trust, and search engines prefer secure sites.",
    howToFix: [
      "Ask your host to enable a free SSL certificate (most offer Let's Encrypt in one click).",
      "Redirect every http:// address to https:// (many hosts have a “force HTTPS” switch).",
      "On WordPress, update Settings → General so both site addresses start with https://.",
    ],
    impact: c.facts.homeHttps === false ? "high" : "medium",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "seo.mobile_viewport": (c) => ({
    title: `${pages(n(c, "missing"))} may not display properly on phones`,
    whatsWrong: "These pages lack the “viewport” setting that tells phones to fit the page to the screen.",
    whyItMatters: "Most visitors browse on phones, and Google ranks sites based on their mobile version.",
    howToFix: [
      "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to the page head.",
      "Most modern WordPress themes include it — if yours doesn't, consider updating the theme.",
    ],
    impact: "medium",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "seo.page_speed_proxy": (c) => ({
    title: `${pages(c.affectedCount)} may load slowly`,
    whatsWrong: `${c.detail} This is an estimate from the page code, not a full speed test.`,
    whyItMatters: "Slow pages lose visitors, and page experience is one of many signals search engines consider.",
    howToFix: [
      "Test your key pages in Google PageSpeed Insights (free) to confirm.",
      "Remove plugins or scripts you don't use; load the rest with “defer”.",
      "On WordPress, a caching/optimisation plugin (e.g. WP Rocket, LiteSpeed Cache) can help.",
    ],
    impact: "low",
    effort: "moderate",
    relatedActionType: "internal_task",
  }),
  "seo.open_graph": (c) => ({
    title: `${pages(n(c, "missing"))} look plain when shared on social media`,
    whatsWrong: "These pages lack Open Graph tags (a title and image for link previews on WhatsApp, LinkedIn, Facebook and others).",
    whyItMatters: "Links with a clear title and picture get noticed and clicked more when shared.",
    howToFix: [
      "Set a sharing title, description and image for each page — Yoast/Rank Math have a “Social” tab for this.",
      "Use an image at least 1200×630 pixels.",
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "update_og_tags",
  }),

  "aeo.question_headings": (c) => ({
    title: "Your pages don't ask the questions customers search for",
    whatsWrong: `Only ${n(c, "withQuestions")} of ${n(c, "total")} content pages have headings phrased as questions (like “How long does installation take?”).`,
    whyItMatters: "People type and speak questions into Google and AI assistants. Pages organised around those questions are easier for them to match and quote.",
    howToFix: [
      "List the 5–10 questions customers ask you most (check emails, calls, reviews).",
      "Add them as subheadings (Heading 2 or 3) on the relevant pages.",
      "Answer each one right below the heading.",
    ],
    impact: sev(c, "medium", "medium"),
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "aeo.direct_answers": (c) => ({
    title: n(c, "questions") ? "Your answers are buried — give a short, direct answer first" : "Your site has no ready-made answers for AI tools to quote",
    whatsWrong: n(c, "questions")
      ? `Only ${n(c, "answered")} of ${n(c, "questions")} question headings are followed by a short answer of about 40–60 words.`
      : "None of your pages contain a question followed by a direct answer.",
    whyItMatters: "Google's featured snippets and AI answers tend to quote a short, self-contained answer. Long or rambling text is harder to lift.",
    howToFix: [
      "Directly under each question heading, write a 2–3 sentence answer (about 40–60 words) that makes sense on its own.",
      "Then add details, examples or steps below it.",
      "Start the answer by restating the subject, e.g. “A boiler service takes about an hour…”.",
    ],
    impact: "medium",
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "aeo.faq_schema": (c) => ({
    title: n(c, "missing") ? `${pages(n(c, "missing"))} with Q&A content lack FAQ markup` : "No FAQ or How-to content is marked up",
    whatsWrong: n(c, "missing")
      ? "These pages contain several questions and answers but no FAQ/How-to “schema” — hidden labels that tell machines “this is a question, this is its answer”."
      : "Your site has no question-and-answer sections or FAQ markup.",
    whyItMatters: "Markup makes your Q&A easier for search engines and AI tools to read reliably. Google now shows FAQ rich results only for some sites, so treat this as a clarity improvement — it may or may not lead to extra search features.",
    howToFix: [
      "Add an FAQ section to your key service pages if you don't have one.",
      "On WordPress, Yoast and Rank Math have an FAQ block that adds the markup automatically.",
      "Check the result with Google's Rich Results Test.",
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "add_faq_schema",
  }),
  "aeo.lists_tables": (c) => ({
    title: `${pages(n(c, "without"))} are walls of text`,
    whatsWrong: `${n(c, "without")} of ${n(c, "total")} content pages have no bullet lists, numbered steps or tables.`,
    whyItMatters: "Answer engines often pull lists (“5 steps to…”) and tables (prices, comparisons) straight into results. They also make pages easier to skim.",
    howToFix: [
      "Turn steps into numbered lists and features into bullet points.",
      "Put prices, plans or comparisons into a simple table.",
    ],
    impact: "low",
    effort: "moderate",
    relatedActionType: "update_content",
  }),
  "aeo.readability": (c) => ({
    title: "Your writing is hard to read",
    whatsWrong: `Your pages average ${n(c, "avg")} on the reading-ease scale (0–100, where 60+ is easy for most adults); ${pages(n(c, "hard"))} score below 40.`,
    whyItMatters: "Plain language helps visitors act, and clear, simple sentences are easier for answer engines to quote accurately.",
    howToFix: [
      "Keep sentences under about 20 words.",
      "Swap jargon for everyday words, or explain terms the first time you use them.",
      "Use short paragraphs (2–4 sentences).",
      "Free tools like the Hemingway Editor highlight hard sentences.",
    ],
    impact: "low",
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "aeo.structured_data": (c) => ({
    title: n(c, "invalid") ? `${pages(n(c, "invalid"))} have broken structured data` : `${pages(n(c, "total") - n(c, "valid"))} have no structured data`,
    whatsWrong: `${n(c, "valid")} of ${n(c, "total")} pages include structured data (schema — hidden labels describing your business, products, articles).${n(c, "invalid") ? ` ${pages(n(c, "invalid"))} contain markup with errors that machines can't read.` : ""}`,
    whyItMatters: "Structured data helps search engines and AI tools read facts about your pages without guessing. Broken markup is ignored entirely.",
    howToFix: [
      "Fix broken markup first: paste the page into Google's Rich Results Test or validator.schema.org to see the error.",
      "On WordPress, Yoast or Rank Math add basic schema (Organization, WebPage, Article) automatically.",
      "Add specific types where they fit: Product, Service, LocalBusiness, FAQPage.",
    ],
    impact: n(c, "invalid") ? "medium" : sev(c, "medium", "low"),
    effort: "moderate",
    relatedActionType: "update_schema",
  }),
  "aeo.content_depth": (c) => ({
    title: `${plural(n(c, "shallow"), "key page")} don't explain what you offer`,
    whatsWrong: `${n(c, "shallow")} of ${n(c, "total")} key pages (home, services, pricing, about…) have under 300 words.`,
    whyItMatters: "These are the pages AI tools and search engines use to understand your business. If they're thin, the tools may describe you vaguely or prefer a competitor.",
    howToFix: [
      "On each key page, cover: what you do, who it's for, where you work, price range, how it works, and why customers choose you.",
      "Add a short FAQ with real customer questions.",
      "Include specifics: years in business, number of customers, service areas, certifications.",
    ],
    impact: sev(c, "high", "medium"),
    effort: "involved",
    relatedActionType: "content_brief",
  }),

  "geo.ai_search_access": (c) => ({
    title: "You're blocking AI search tools from reading your site",
    whatsWrong: `${c.detail} These bots fetch pages so tools like ChatGPT search or Perplexity can answer questions and link to sources.`,
    whyItMatters: "If they can't read your pages, those tools can't quote or cite you — they'll use other websites instead.",
    howToFix: [
      "Open yourdomain/robots.txt and find the “User-agent:” lines for the bots listed.",
      "Remove their “Disallow: /” lines (or the whole block) if you want to appear in AI answers.",
      "You can keep training crawlers (GPTBot, CCBot, Google-Extended) blocked — that's separate.",
      "On WordPress, robots.txt is often managed by Yoast/Rank Math under Tools → File editor.",
    ],
    impact: "high",
    effort: "quick",
    relatedActionType: "robots_review",
  }),
  "geo.ai_training_access": (c) => ({
    title: "You block AI training crawlers (a business choice)",
    whatsWrong: c.detail,
    whyItMatters: "This only affects what future AI models may learn from your site. It does not stop live AI search tools that you allow. There's no right answer — it's your decision.",
    howToFix: [
      "Keep it as is if you don't want your content used for AI training.",
      "If you'd like AI models to learn about your brand, remove those bots' “Disallow” lines from robots.txt.",
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "robots_review",
  }),
  "geo.llms_txt": () => ({
    title: "Optional: add an llms.txt guide for AI tools",
    whatsWrong: "Your site has no /llms.txt — a short text file that points AI tools to your most important pages.",
    whyItMatters: "This is a new convention. There's no evidence yet that major AI tools rely on it, so treat it as a low-priority extra.",
    howToFix: [
      "Create a plain-text file at yourdomain/llms.txt.",
      "Start with your business name and one-line description, then list links to your key pages with a sentence each.",
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "geo.quotable_facts": (c) => ({
    title: "Your pages lack specific facts AI tools can quote",
    whatsWrong: `Only ${n(c, "withStats")} of ${n(c, "total")} content pages include at least two concrete facts or figures (prices, years, results, percentages).`,
    whyItMatters: "Generative AI tools tend to cite sources that state clear, checkable facts. Vague claims (“best service”) give them nothing to quote.",
    howToFix: [
      "Add real numbers you can stand behind: years in business, customers served, response times, price ranges, results.",
      "Write them as full sentences, e.g. “We've installed over 1,200 solar systems in Kerala since 2015.”",
      "Cite where a statistic comes from if it isn't your own.",
    ],
    impact: sev(c, "medium", "medium"),
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "geo.cited_sources": (c) => ({
    title: "Your content doesn't back up claims with trusted sources",
    whatsWrong: `Only ${n(c, "citing")} of ${n(c, "total")} content pages link to an authoritative source (government, university, research, standards body or major news outlet).`,
    whyItMatters: "Linking to reliable sources signals that your content is well researched — a trust signal for readers, search engines and AI tools.",
    howToFix: [
      "When you mention a regulation, statistic or study, link to the original source.",
      "Prefer official sources (government sites, industry bodies, research papers) over blogs.",
    ],
    impact: "low",
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "geo.freshness": (c) => ({
    title: "Your content doesn't show it's up to date",
    whatsWrong: `${n(c, "dated")} of ${n(c, "total")} content pages show a published or “last updated” date, and ${n(c, "recent")} were updated in the past year.`,
    whyItMatters: "AI tools and search engines often prefer recent information, especially for prices, rules and comparisons. Without dates they can't tell.",
    howToFix: [
      "Review your key pages and update anything outdated (prices, team, services).",
      "Show a “Last updated: <date>” line on articles and guides.",
      "On WordPress, many themes can display the modified date; SEO plugins add it to the page's markup.",
    ],
    impact: sev(c, "medium", "low"),
    effort: "moderate",
    relatedActionType: "update_content",
  }),
  "geo.author_signals": (c) => ({
    title: `${plural(n(c, "total") - n(c, "withAuthor"), "article")} don't say who wrote them`,
    whatsWrong: `Only ${n(c, "withAuthor")} of ${n(c, "total")} articles name an author.`,
    whyItMatters: "Showing real people with real expertise (what Google calls E-E-A-T: experience, expertise, authority, trust) makes content more credible to readers and AI tools.",
    howToFix: [
      "Add an author name to every article, linked to a short bio page.",
      "In the bio, mention relevant experience, qualifications and a LinkedIn profile.",
      "On WordPress, set each post's author and fill in Users → Profile → Biographical Info.",
    ],
    impact: "medium",
    effort: "quick",
    relatedActionType: "update_content",
  }),
  "geo.entity_clarity": (c) => ({
    title: c.facts.hasOrg ? "AI tools can't easily link your site to your official profiles" : "AI tools have to guess who your business is",
    whatsWrong: c.facts.hasOrg
      ? `Your business markup lists ${plural(n(c, "sameAs"), "official profile")}. The “sameAs” list tells machines which social, LinkedIn, Wikipedia or directory profiles belong to you.`
      : "Your site has no Organization markup — the hidden label that states your business name, logo, website and official profiles. Without it, search engines and AI tools have to piece together who you are.",
    whyItMatters: "Generative AI tools build a picture of a business from many sources. Clearly linking your website to your official profiles helps them recognise you as one entity and describe you correctly.",
    howToFix: [
      "On WordPress: Yoast → Settings → Site representation (or Rank Math → Titles & Meta → Local SEO) — set Organization, name and logo.",
      "Add your official profile links (LinkedIn, Facebook, Instagram, YouTube, Google Business Profile, Wikipedia if you have one).",
      "Use exactly the same business name everywhere.",
    ],
    impact: c.facts.hasOrg ? "medium" : "high",
    effort: "quick",
    relatedActionType: "update_schema",
  }),
  "geo.ai_mention_rate": (c) => ({
    title: "AI assistants rarely mention your brand",
    whatsWrong: c.detail,
    whyItMatters: "More people now ask ChatGPT, Gemini or Perplexity for recommendations. If you're not mentioned, those customers may not hear of you.",
    howToFix: [
      "Look at the questions where you were missing (listed in this report) and make sure your site clearly answers them.",
      "Build pages for the services and locations you want to be known for.",
      "Get listed and reviewed on the third-party sites AI tools cite most often in your market.",
      "Re-measure after changes; results vary between runs, so look at trends.",
    ],
    impact: sev(c, "high", "medium"),
    effort: "involved",
    relatedActionType: "content_brief",
  }),
  "geo.ai_citation_rate": (c) => ({
    title: "AI answers rarely link to your website",
    whatsWrong: c.detail,
    whyItMatters: "When an AI answer cites your page, people can click through to you. Being cited also signals your content is seen as a reliable source.",
    howToFix: [
      "Make sure AI search bots are allowed in robots.txt.",
      "Publish clear, factual pages answering the exact questions people ask (with short direct answers).",
      "Study the sites that are cited instead — what do they cover that you don't?",
    ],
    impact: sev(c, "medium", "medium"),
    effort: "involved",
    relatedActionType: "content_brief",
  }),
  "geo.competitor_share": (c) => ({
    title: c.facts.topCompetitor ? `${String(c.facts.topCompetitor)} gets mentioned by AI more than you` : "Your brand has little share of voice in AI answers",
    whatsWrong: c.detail,
    whyItMatters: "When customers ask AI for options, the brands mentioned most often are the ones they'll consider first.",
    howToFix: [
      "Compare your pages with the competitor's: which topics, comparisons or locations do they cover that you don't?",
      "Create honest comparison and “alternatives” pages that explain where you're a good fit.",
      "Encourage happy customers to leave reviews on the platforms in your industry.",
    ],
    impact: "medium",
    effort: "involved",
    relatedActionType: "comparison_page_brief",
  }),

  "brand.name_consistency": (c) => ({
    title: "Your brand name is missing from key places",
    whatsWrong: c.detail,
    whyItMatters: "Using your brand name consistently in titles and headings helps search engines and AI tools connect your pages to your business.",
    howToFix: [
      "Add your brand name to the end of every page title, e.g. “Services | Your Brand”.",
      "Mention it in your homepage's main heading or first paragraph.",
      "Use exactly the same spelling everywhere (website, social profiles, directories).",
    ],
    impact: sev(c, "medium", "low"),
    effort: "quick",
    relatedActionType: "update_title",
  }),
  "brand.organization_schema": (c) => ({
    title: c.facts.hasOrg ? "Your business markup is incomplete" : "Your website doesn't formally state who you are",
    whatsWrong: c.detail,
    whyItMatters: "Organization markup tells Google and AI tools your official name, logo and website — it can feed the brand panel shown in search.",
    howToFix: [
      "On WordPress: Yoast → Settings → Site representation (or Rank Math → Titles & Meta → Local SEO).",
      "Choose “Organization”, enter your exact business name and upload a square logo.",
      "Local businesses: use LocalBusiness with address, phone and opening hours.",
    ],
    impact: c.facts.hasOrg ? "low" : "medium",
    effort: "quick",
    relatedActionType: "update_schema",
  }),
  "brand.about_page": () => ({
    title: "Visitors can't find out who's behind your business",
    whatsWrong: "We couldn't find an About page linked from your site.",
    whyItMatters: "An About page builds trust with customers and gives AI tools and search engines facts about your business: who you are, where, since when.",
    howToFix: [
      "Create an About page: your story, team, location, years in business, qualifications.",
      "Link it from your main menu or footer.",
    ],
    impact: "medium",
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "brand.contact_info": (c) => ({
    title: "Your contact details are hard to find",
    whatsWrong: c.detail,
    whyItMatters: "Clear contact details (name, address, phone) build trust, help local search, and let AI tools give people correct details.",
    howToFix: [
      "Add a Contact page linked from your menu.",
      "Show your phone number as a tap-to-call link and your email as a clickable link.",
      "Add your business address to your Organization/LocalBusiness markup, matching your Google Business Profile exactly.",
    ],
    impact: sev(c, "medium", "low"),
    effort: "quick",
    relatedActionType: "update_content",
  }),
  "brand.privacy_policy": () => ({
    title: "No privacy policy found",
    whatsWrong: "We couldn't find a privacy policy link on your site.",
    whyItMatters: "A privacy policy is expected by visitors and often required by law if you collect any personal data (contact forms, analytics). It's also a basic trust signal.",
    howToFix: [
      "Publish a privacy policy that explains what data you collect and why (WordPress: Settings → Privacy can generate a starting draft).",
      "Have it reviewed for your country's rules, then link it in your footer.",
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "brand.social_profiles": (c) => ({
    title: n(c, "platforms") ? "Link to more of your social profiles" : "Your site doesn't link to your social profiles",
    whatsWrong: c.detail,
    whyItMatters: "Linking to your official profiles helps people verify you and helps AI tools connect your brand across the web.",
    howToFix: [
      "Add icons linking to your active profiles (LinkedIn, Instagram, Facebook, YouTube…) in the footer.",
      "Add the same links to your Organization markup's “sameAs” list.",
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "update_content",
  }),
  "brand.ai_recommendation": (c) => ({
    title: "AI tools rarely recommend your business",
    whatsWrong: c.detail,
    whyItMatters: "Being mentioned is good; being recommended is what turns AI answers into customers.",
    howToFix: [
      "Make your strengths explicit on your site: who you're best for, results, warranties you actually offer, awards, reviews.",
      "Collect reviews on the third-party sites that AI answers cite in your market.",
      "Answer “best X for Y” questions honestly on your own pages.",
    ],
    impact: sev(c, "high", "medium"),
    effort: "involved",
    relatedActionType: "content_brief",
  }),
  "brand.ai_knowledge": (c) => ({
    title: n(c, "inaccuracies") ? "AI tools say inaccurate things about your brand" : "Some AI tools don't know your brand",
    whatsWrong: `${c.detail}${c.evidence ? ` For example — ${c.evidence}` : ""}`,
    whyItMatters: "People increasingly trust what AI assistants tell them. Wrong or missing information can send customers elsewhere.",
    howToFix: [
      "Make sure your About, Contact and service pages state the correct facts plainly.",
      "Update the same facts on your Google Business Profile, LinkedIn and key directories.",
      "Add Organization markup with sameAs links so the facts can be connected to you.",
    ],
    impact: n(c, "inaccuracies") ? "high" : "medium",
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
};

const STRENGTHS: Record<string, string> = {
  "seo.indexability": "Your pages load correctly and are open to search engines.",
  "seo.titles": "Every page has its own clear title.",
  "seo.meta_description": "Your pages have their own search descriptions.",
  "seo.h1": "Each page has one clear main heading.",
  "seo.broken_links": "No broken links between your pages.",
  "seo.sitemap": "You have a sitemap that helps search engines find your pages.",
  "seo.https": "Your site is secure (HTTPS).",
  "seo.mobile_viewport": "Your pages are set up for phones.",
  "seo.thin_content": "Your content pages have substance.",
  "seo.duplicate_content": "Your pages each have their own text.",
  "seo.canonical": "Your pages declare their preferred address.",
  "aeo.question_headings": "Your pages are organised around real questions.",
  "aeo.direct_answers": "You give short, direct answers that answer engines can quote.",
  "aeo.faq_schema": "Your Q&A content is marked up for machines.",
  "aeo.structured_data": "Your pages use structured data.",
  "aeo.content_depth": "Your key pages explain your offer in depth.",
  "aeo.readability": "Your writing is easy to read.",
  "geo.ai_search_access": "AI search tools are free to read your site.",
  "geo.quotable_facts": "Your pages include concrete facts and figures AI tools can quote.",
  "geo.cited_sources": "You back up content with trusted sources.",
  "geo.freshness": "Your content is dated and recently updated.",
  "geo.author_signals": "Your articles name their authors.",
  "geo.entity_clarity": "Your business identity is clearly linked to your official profiles.",
  "geo.ai_mention_rate": "AI assistants mention your brand often in the answers we sampled.",
  "geo.ai_citation_rate": "AI answers often cite your website as a source.",
  "geo.competitor_share": "You lead competitors in AI share of voice in our sample.",
  "brand.name_consistency": "Your brand name is used consistently across your pages.",
  "brand.organization_schema": "Your business details and logo are marked up.",
  "brand.about_page": "You have an About page.",
  "brand.contact_info": "Your contact details are easy to find.",
  "brand.privacy_policy": "You publish a privacy policy.",
  "brand.social_profiles": "You link to your social profiles.",
  "brand.ai_recommendation": "AI tools recommend your business in many answers.",
  "brand.ai_knowledge": "AI tools know your brand and describe it accurately.",
};

/** Audit finding codes already explained by a check (not repeated as separate issues). */
export const COVERED_FINDING_CODES = new Set([
  "fetch_failed", "server_error", "client_error", "non_200_status", "noindex", "redirect_chain",
  "missing_title", "title_too_long", "title_too_short", "duplicate_title",
  "missing_meta_description", "meta_description_too_long", "duplicate_meta_description",
  "missing_h1", "multiple_h1", "missing_canonical", "canonical_other_host",
  "images_missing_alt", "thin_content", "duplicate_content", "broken_internal_link", "no_sitemap",
  "invalid_json_ld", "no_structured_data", "missing_organization_schema", "question_page_without_faq_schema",
  "ai_crawler_access", "no_llms_txt",
]);

const FINDING_COPY: Record<string, Omit<Copy, "impact"> & { pillar: Pillar }> = {
  missing_lang: {
    pillar: "seo",
    title: "Your pages don't say what language they're in",
    whatsWrong: "The page code has no language setting (the “lang” attribute).",
    whyItMatters: "It helps search engines show the right language to the right people and helps screen readers pronounce text correctly.",
    howToFix: ["Set your site language (WordPress: Settings → General → Site Language) — most themes then add it automatically."],
    effort: "quick",
    relatedActionType: "internal_task",
  },
  heading_level_skip: {
    pillar: "seo",
    title: "Your headings jump levels",
    whatsWrong: "Some pages jump from a big heading straight to a much smaller one (e.g. Heading 1 → Heading 4), which breaks the page outline.",
    whyItMatters: "A tidy outline helps screen readers, search engines and AI tools understand how sections relate.",
    howToFix: ["Use headings in order: one Heading 1, then Heading 2 for sections, Heading 3 for sub-sections.", "Change heading levels in your editor rather than using them for text size."],
    effort: "quick",
    relatedActionType: "update_content",
  },
};

const IMPACT_RANK: Record<IssueImpact, number> = { high: 0, medium: 1, low: 2 };
const EFFORT_RANK: Record<IssueEffort, number> = { quick: 0, moderate: 1, involved: 2 };
const SEVERITY_IMPACT: Record<string, IssueImpact> = { critical: "high", high: "high", medium: "medium", low: "low", info: "low" };

export function sortIssues(issues: ReportIssue[]): ReportIssue[] {
  return [...issues].sort(
    (a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact] || EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort] || b.affectedCount - a.affectedCount,
  );
}

/** Issues that repeat another one when both are caused by the same missing thing. */
function isSuperseded(c: EvaluatedCheck, checks: EvaluatedCheck[]): boolean {
  if (c.id === "brand.organization_schema" && c.facts.hasOrg === false) {
    // "No Organization markup" is already explained (with the same fix) by geo.entity_clarity.
    return checks.some((o) => o.id === "geo.entity_clarity" && o.facts.hasOrg === false && (o.status === "fail" || o.status === "warn"));
  }
  return false;
}

export function buildIssues(checks: EvaluatedCheck[], findings: ReportFinding[] = []): ReportIssue[] {
  const byId = new Map<string, ReportIssue>();
  for (const c of checks) {
    if (c.status !== "fail" && c.status !== "warn") continue;
    if (isSuperseded(c, checks)) continue;
    const fn = COPY[c.id];
    const copy = fn?.(c);
    if (!copy) continue;
    const id = c.id.replace(/\./g, "-");
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      pillar: c.pillar,
      ...copy,
      whatsWrong: copy.whatsWrong.trim() || c.detail,
      affectedUrls: c.affectedUrls.slice(0, MAX_AFFECTED),
      affectedCount: c.affectedCount,
      evidence: c.evidence,
    });
  }

  // Remaining audit findings not already explained by a check.
  const groups = new Map<string, ReportFinding[]>();
  for (const f of findings) {
    if (COVERED_FINDING_CODES.has(f.code)) continue;
    const arr = groups.get(f.code) ?? [];
    arr.push(f);
    groups.set(f.code, arr);
  }
  for (const [code, fs] of groups) {
    const id = `finding-${code.replace(/_/g, "-")}`;
    if (byId.has(id)) continue;
    const urls = Array.from(new Set(fs.map((f) => f.pageUrl).filter((u): u is string => !!u)));
    const worst = fs.map((f) => SEVERITY_IMPACT[f.severity] ?? "low").sort((a, b) => IMPACT_RANK[a] - IMPACT_RANK[b])[0] ?? "low";
    const copy = FINDING_COPY[code];
    byId.set(id, copy
      ? { id, ...copy, impact: worst, affectedUrls: urls.slice(0, MAX_AFFECTED), affectedCount: urls.length || fs.length, evidence: fs[0].message.slice(0, 200) }
      : {
          id,
          pillar: fs[0].category === "ai_readiness" ? "geo" : fs[0].category === "schema" ? "aeo" : "seo",
          title: fs[0].message.slice(0, 120),
          whatsWrong: `${fs[0].message} This was found on ${pages(urls.length || fs.length)}.`,
          whyItMatters: "Our technical audit flagged this as something that can make your pages harder for search engines or AI tools to read.",
          howToFix: ["Open the listed pages and review the issue described.", "If you're unsure, share this item with your web developer."],
          impact: worst,
          effort: "moderate",
          affectedUrls: urls.slice(0, MAX_AFFECTED),
          affectedCount: urls.length || fs.length,
        });
  }
  return sortIssues(Array.from(byId.values()));
}

export function quickWins(issues: ReportIssue[], max = 5): string[] {
  return issues.filter((i) => (i.impact === "high" || i.impact === "medium") && i.effort === "quick").slice(0, max).map((i) => i.id);
}

/** Important checks that passed, phrased positively (highest weight first). */
export function strengths(checks: EvaluatedCheck[], max = 8): string[] {
  return checks
    .filter((c) => c.status === "pass" && c.weight >= 1.5 && STRENGTHS[c.id])
    .sort((a, b) => b.weight - a.weight || b.score - a.score)
    .slice(0, max)
    .map((c) => STRENGTHS[c.id]);
}

/** Every check id that has issue copy (used by tests to verify coverage). */
export const ISSUE_COPY_IDS = Object.keys(COPY);
