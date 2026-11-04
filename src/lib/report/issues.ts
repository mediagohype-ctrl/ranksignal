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
/** "1 page has" / "3 pages have" — keeps the verb in step with the count. */
const pagesHave = (k: number) => `${pages(k)} ${k === 1 ? "has" : "have"}`;
const pagesAre = (k: number) => `${pages(k)} ${k === 1 ? "is" : "are"}`;
/** Prefix for the one technical step a web developer needs (kept out of titles). */
const DEV = "For your web developer:";

const WP_PLUGIN = "On WordPress, a plugin such as Yoast or Rank Math adds a box for this under each page's editor.";

const COPY: Record<string, CopyFn> = {
  "seo.indexability": (c) => ({
    title: n(c, "errors") ? `${pages(n(c, "errors") + n(c, "noindex"))} can't show up on Google` : `${pagesAre(n(c, "noindex"))} hidden from Google`,
    whatsWrong: [
      n(c, "errors") ? `${pages(n(c, "errors"))} showed an error (like "page not found") or didn't load when we visited.` : "",
      n(c, "noindex") ? `${pagesHave(n(c, "noindex"))} a hidden setting that tells Google not to show ${n(c, "noindex") === 1 ? "it" : "them"}.` : "",
    ].filter(Boolean).join(" "),
    whyItMatters: "Pages that are broken or hidden from Google don't show up in search, and AI assistants are unlikely to use them either.",
    howToFix: [
      "Open each listed page in your browser and check whether it should exist.",
      "For broken pages: bring the content back, or send visitors to the closest working page.",
      "For hidden pages you want found: switch the hiding setting off (WordPress: Settings → Reading → untick “Discourage search engines”).",
      "Keep pages hidden only if you mean to, such as thank-you or login pages.",
      `${DEV} fix 4xx/5xx responses or add 301 redirects, and remove the "noindex" robots meta tag from pages that should be indexed.`,
    ],
    impact: "high",
    effort: "moderate",
    relatedActionType: "internal_task",
  }),
  "seo.redirects": (c) => ({
    title: `${pages(n(c, "chains"))} send${n(c, "chains") === 1 ? "s" : ""} visitors through several hops before loading`,
    whatsWrong: `To reach ${n(c, "chains") === 1 ? "this page" : "these pages"}, the browser is passed from one address to another two or more times.`,
    whyItMatters: "Each extra hop makes the page slower, and Google may give up on long chains.",
    howToFix: [
      "Update your menus and links so they point straight at the final address.",
      "Change old forwarding rules so they go to the final page in one step (on WordPress, the Redirection plugin lists them).",
      `${DEV} collapse redirect chains into a single 301 redirect.`,
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "create_redirect",
  }),
  "seo.titles": (c) => {
    const bad = n(c, "missing") + n(c, "duplicate") + n(c, "short");
    return {
      title: bad ? `Google headline missing or unclear on ${pages(bad)}` : `Google headline too long on ${pages(n(c, "long"))} — Google cuts it off`,
      whatsWrong: [
        n(c, "missing") ? `${pagesHave(n(c, "missing"))} no Google headline.` : "",
        n(c, "duplicate") ? `${pagesHave(n(c, "duplicate"))} the same Google headline as another page, so they look the same in search results.` : "",
        n(c, "short") ? `${pagesHave(n(c, "short"))} a very short Google headline that doesn't say what the page is about.` : "",
        n(c, "long") ? `${pagesHave(n(c, "long"))} a Google headline over 60 characters, which Google usually cuts off with “…”.` : "",
      ].filter(Boolean).join(" ") + " The Google headline is the blue clickable line people see in Google.",
      whyItMatters: "It's one of the strongest hints Google and AI assistants use to understand a page, and it's what makes people click.",
      howToFix: [
        "Give every page its own headline of about 50–60 characters.",
        "Put the main topic first and your business name last, e.g. “Emergency Plumber in Pune | Acme Plumbing”.",
        WP_PLUGIN,
        "Start with your homepage and the pages that bring in customers (services, prices).",
        `${DEV} set a unique <title> tag on each page.`,
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
        ? `Google summary too long on ${pages(n(c, "long"))} — Google cuts it off`
        : n(c, "missing") === 0
          ? `Google summary copied on ${pages(bad)}`
          : `Google summary missing on ${pages(bad)} — Google shows random text from the page instead`,
      whatsWrong: [
        n(c, "missing") ? `${pagesHave(n(c, "missing"))} no Google summary — the short text shown under your link in Google.` : "",
        n(c, "duplicate") ? `${pagesHave(n(c, "duplicate"))} the same Google summary as another page.` : "",
        n(c, "long") ? `${pagesHave(n(c, "long"))} a Google summary over 160 characters.` : "",
      ].filter(Boolean).join(" "),
      whyItMatters: "Without one, Google picks random text from the page. A clear summary can win more clicks, and AI assistants sometimes use it to describe the page.",
      howToFix: [
        "Write a unique 1–2 sentence summary (120–155 characters) for each page.",
        "Say what the page offers and who it's for, and give one reason to click.",
        WP_PLUGIN,
        `${DEV} add a unique <meta name="description"> tag to each page.`,
      ],
      impact: sev(c, "medium", "medium"),
      effort: "quick",
      relatedActionType: "update_meta_description",
    };
  },
  "seo.h1": (c) => ({
    title: n(c, "missing") ? `Main heading missing on ${pages(n(c, "missing"))}` : `${pagesHave(n(c, "multiple"))} more than one main heading`,
    whatsWrong: `${n(c, "missing") ? `${pagesHave(n(c, "missing"))} no main heading (the big headline at the top of the page). ` : ""}${n(c, "multiple") ? `${pagesHave(n(c, "multiple"))} several main headings, which makes it unclear what the page is about.` : ""}`,
    whyItMatters: "One clear headline helps visitors, Google and AI assistants see the main topic quickly.",
    howToFix: [
      "Give each page one headline that states its main topic, set as “Heading 1”.",
      "Turn any other big headlines into “Heading 2” or “Heading 3”.",
      "On WordPress, the page title is usually the main heading — check your theme doesn't add a second one (e.g. the logo).",
      `${DEV} each page should have exactly one <h1>.`,
    ],
    impact: sev(c, "medium", "low"),
    effort: "quick",
    relatedActionType: "update_content",
  }),
  "seo.canonical": (c) => ({
    title: n(c, "offsite")
      ? `${pages(n(c, "offsite"))} tell${n(c, "offsite") === 1 ? "s" : ""} Google another website is the original`
      : `${pages(n(c, "missing"))} ${n(c, "missing") === 1 ? "doesn't" : "don't"} say which version is the main one`,
    whatsWrong: `${n(c, "offsite") ? `${pagesHave(n(c, "offsite"))} a hidden note that points Google to a different website as the main version, so that site gets the credit. ` : ""}${n(c, "missing") ? `${pagesHave(n(c, "missing"))} no hidden note saying “this is the main version of the page”.` : ""}`,
    whyItMatters: "Without it, Google may split credit between copies of the same page (e.g. with and without “www”) or pick the wrong one.",
    howToFix: [
      "Plugins like Yoast or Rank Math add this note automatically — make sure one is installed and switched on.",
      "Fix any page that points to another website, unless you copied that content on purpose.",
      `${DEV} add a <link rel="canonical"> tag pointing at the page's own preferred URL.`,
    ],
    impact: n(c, "offsite") ? "high" : "low",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "seo.broken_links": (c) => ({
    title: `${plural(n(c, "broken"), "link")} on your site lead${n(c, "broken") === 1 ? "s" : ""} to error pages`,
    whatsWrong: `We found ${plural(n(c, "broken"), "link")} between your own pages that end on a “page not found” or error page.`,
    whyItMatters: "Broken links annoy visitors and waste the time Google spends on your site.",
    howToFix: [
      "Open each listed page and find the links to the broken addresses.",
      "Point them at the right page, or remove them.",
      "If a page moved, send visitors from the old address to the new one.",
      `${DEV} add a 301 redirect from each moved URL.`,
    ],
    impact: "medium",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "seo.internal_links": (c) => ({
    title: `${pages(n(c, "orphans"))} ${n(c, "orphans") === 1 ? "isn't" : "aren't"} linked from anywhere on your site`,
    whatsWrong: "These pages exist, but none of the other pages we checked link to them, so visitors (and Google) struggle to find them.",
    whyItMatters: "Google judges how important a page is partly by how many of your own pages link to it.",
    howToFix: [
      "Add links to these pages from related pages, your menu or your footer.",
      "Use clear link words (“see our prices”) rather than “click here”.",
    ],
    impact: "low",
    effort: "moderate",
    relatedActionType: "internal_task",
  }),
  "seo.image_alt": (c) => ({
    title: `${plural(n(c, "missing"), "image")} ${n(c, "missing") === 1 ? "has" : "have"} no image description`,
    whatsWrong: `${n(c, "missing")} of ${n(c, "images")} images have no image description — a short line of text saying what the picture shows.`,
    whyItMatters: "Image descriptions let screen readers describe your pictures to blind visitors, and help Google understand them (and show them in image search).",
    howToFix: [
      "Describe what each image shows in a few words, e.g. “Technician repairing a water heater”.",
      "On WordPress: Media → Library → click an image → fill in “Alternative Text”.",
      "Leave it empty only for purely decorative images.",
      `${DEV} add an alt attribute to each <img>.`,
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "update_image_alt",
  }),
  "seo.thin_content": (c) => ({
    title: `${pagesHave(n(c, "thin"))} very little text`,
    whatsWrong: `${n(c, "thin")} of ${n(c, "total")} content pages have fewer than 300 words, so they say little about what you offer.`,
    whyItMatters: "Short pages give Google and AI assistants little to understand or quote, so they're less likely to show up for the questions your customers ask.",
    howToFix: [
      "Start with your most important pages (services, products, locations).",
      "Answer the questions customers actually ask: what it is, who it's for, price range, how it works, why choose you.",
      "Add real details — examples, numbers, photos with descriptions, common questions.",
      "Merge very similar short pages into one stronger page.",
    ],
    impact: sev(c, "high", "medium"),
    effort: "involved",
    relatedActionType: "content_brief",
  }),
  "seo.duplicate_content": (c) => ({
    title: `${pagesAre(n(c, "duplicates"))} word-for-word copies of another page`,
    whatsWrong: "Some pages have exactly the same text, often because of duplicate addresses or copied templates.",
    whyItMatters: "Google usually shows only one copy and may pick the wrong one. Copies also weaken your site.",
    howToFix: [
      "Decide which copy should be the main version of the page.",
      "Send visitors from the other copies to it.",
      "If the pages should be different (e.g. two locations), rewrite each with its own details.",
      `${DEV} 301-redirect the duplicates, or set their canonical tag to the main URL.`,
    ],
    impact: "medium",
    effort: "moderate",
    relatedActionType: "internal_task",
  }),
  "seo.sitemap": () => ({
    title: "Your site has no page list for Google",
    whatsWrong: "We couldn't find a sitemap — a list of your pages that Google reads to find your content.",
    whyItMatters: "Without one, new or hard-to-reach pages may take longer to show up on Google.",
    howToFix: [
      "On WordPress, Yoast or Rank Math create one for you (usually at /sitemap_index.xml).",
      "Send it to Google in Google Search Console (free), and to Bing Webmaster Tools.",
      `${DEV} publish an XML sitemap and add a “Sitemap: https://yourdomain/sitemap.xml” line to robots.txt.`,
    ],
    impact: "medium",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "seo.https": (c) => ({
    title: c.facts.homeHttps === false ? "Your website isn't secure (no padlock)" : "Some visitors can still reach an unsecured version of your site",
    whatsWrong: c.detail,
    whyItMatters: "Browsers warn people about unsecured pages, which hurts trust, and Google prefers secure sites.",
    howToFix: [
      "Ask your web host to switch on a free security certificate (most offer one in a single click).",
      "Turn on your host's “force HTTPS” switch so every visitor gets the secure version.",
      "On WordPress, update Settings → General so both site addresses start with https://.",
      `${DEV} install an SSL certificate and 301-redirect all http:// URLs to https://.`,
    ],
    impact: c.facts.homeHttps === false ? "high" : "medium",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "seo.mobile_viewport": (c) => ({
    title: `${pages(n(c, "missing"))} may not fit properly on phones`,
    whatsWrong: "These pages are missing the setting that tells phones to fit the page to the screen.",
    whyItMatters: "Most visitors browse on phones, and Google ranks sites based on how they work on a phone.",
    howToFix: [
      "Most modern WordPress themes include this setting — if yours doesn't, consider updating the theme.",
      `${DEV} add <meta name="viewport" content="width=device-width, initial-scale=1"> to the page head.`,
    ],
    impact: "medium",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "seo.page_speed_proxy": (c) => ({
    title: `${pages(c.affectedCount)} may load slowly`,
    whatsWrong: `${c.detail} This is an estimate from the page code, not a full speed test.`,
    whyItMatters: "Slow pages lose visitors, and page speed is one of many things Google looks at.",
    howToFix: [
      "Test your key pages in Google PageSpeed Insights (free) to confirm.",
      "Remove plugins you don't use.",
      "On WordPress, a speed plugin (e.g. WP Rocket, LiteSpeed Cache) can help.",
      `${DEV} trim page HTML and load non-critical scripts with “defer”.`,
    ],
    impact: "low",
    effort: "moderate",
    relatedActionType: "internal_task",
  }),
  "seo.open_graph": (c) => ({
    title: `Share preview missing on ${pages(n(c, "missing"))} — links look plain on WhatsApp and social media`,
    whatsWrong: "These pages have no share preview (the title and picture shown when someone shares the link on WhatsApp, LinkedIn, Facebook and others).",
    whyItMatters: "Links with a clear title and picture get noticed and clicked more when shared.",
    howToFix: [
      "Set a sharing title, description and picture for each page — Yoast and Rank Math have a “Social” tab for this.",
      "Use a picture at least 1200×630 pixels.",
      `${DEV} add og:title, og:description and og:image (Open Graph) tags.`,
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "update_og_tags",
  }),

  "aeo.question_headings": (c) => ({
    title: "Your pages don't ask the questions customers search for",
    whatsWrong: `Only ${n(c, "withQuestions")} of ${n(c, "total")} content pages have headings written as questions (like “How long does installation take?”).`,
    whyItMatters: "People type and speak questions into Google and AI assistants. Pages built around those questions are easier for them to match and quote.",
    howToFix: [
      "List the 5–10 questions customers ask you most (check emails, calls, reviews).",
      "Add them as subheadings (Heading 2 or 3) on the right pages.",
      "Answer each one right below the heading.",
    ],
    impact: sev(c, "medium", "medium"),
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "aeo.direct_answers": (c) => ({
    title: n(c, "questions") ? "Your answers are buried — give a short, direct answer first" : "Your site has no ready-made answers for AI assistants to quote",
    whatsWrong: n(c, "questions")
      ? `Only ${n(c, "answered")} of ${n(c, "questions")} question headings are followed by a short answer of about 40–60 words.`
      : "None of your pages have a question followed by a direct answer.",
    whyItMatters: "Google and AI assistants like to quote a short answer that makes sense on its own. Long or rambling text is harder to use.",
    howToFix: [
      "Right under each question heading, write a 2–3 sentence answer (about 40–60 words) that makes sense on its own.",
      "Then add details, examples or steps below it.",
      "Start the answer by repeating the subject, e.g. “A boiler service takes about an hour…”.",
    ],
    impact: "medium",
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "aeo.faq_schema": (c) => ({
    title: n(c, "missing") ? `${pagesHave(n(c, "missing"))} questions and answers but no info for Google and AI` : "Your questions and answers have no info for Google and AI",
    whatsWrong: n(c, "missing")
      ? "These pages have several questions and answers, but no hidden labels that tell Google and AI “this is a question, this is its answer”."
      : "Your site has no question-and-answer sections, and none are labelled for Google and AI.",
    whyItMatters: "These labels make your questions and answers easier for Google and AI assistants to read correctly. It may or may not lead to extra features in Google, so treat it as a clarity boost.",
    howToFix: [
      "Add a “Common questions” section to your key service pages if you don't have one.",
      "On WordPress, Yoast and Rank Math have an FAQ block that adds the labels for you.",
      `${DEV} add FAQPage (or HowTo) structured data and check it with Google's Rich Results Test.`,
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "add_faq_schema",
  }),
  "aeo.lists_tables": (c) => ({
    title: `${pagesAre(n(c, "without"))} walls of text`,
    whatsWrong: `${n(c, "without")} of ${n(c, "total")} content pages have no bullet lists, numbered steps or tables.`,
    whyItMatters: "Google and AI assistants often pull lists (“5 steps to…”) and tables (prices, comparisons) straight into their answers. They also make pages easier to skim.",
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
    whatsWrong: `Your pages average ${n(c, "avg")} on a reading-ease scale (0–100, where 60+ is easy for most adults); ${pages(n(c, "hard"))} score${n(c, "hard") === 1 ? "s" : ""} below 40.`,
    whyItMatters: "Plain language helps visitors act, and clear, simple sentences are easier for AI assistants to quote correctly.",
    howToFix: [
      "Keep sentences under about 20 words.",
      "Swap trade terms for everyday words, or explain them the first time you use them.",
      "Use short paragraphs (2–4 sentences).",
      "Free tools like the Hemingway Editor highlight hard sentences.",
    ],
    impact: "low",
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "aeo.structured_data": (c) => ({
    title: n(c, "invalid") ? `Info for Google and AI is broken on ${pages(n(c, "invalid"))}` : `Info for Google and AI missing on ${pages(n(c, "total") - n(c, "valid"))}`,
    whatsWrong: `${n(c, "valid")} of ${n(c, "total")} pages include info for Google and AI (hidden labels that describe your business, products and articles).${n(c, "invalid") ? ` ${pagesHave(n(c, "invalid"))} labels with mistakes that can't be read.` : ""}`,
    whyItMatters: "These labels let Google and AI assistants read facts about your pages without guessing. Broken labels are ignored completely.",
    howToFix: [
      "Fix broken labels first.",
      "On WordPress, Yoast or Rank Math add the basic labels for you.",
      `${DEV} validate the JSON-LD with Google's Rich Results Test or validator.schema.org, then add fitting schema types (Organization, Product, Service, LocalBusiness, FAQPage).`,
    ],
    impact: n(c, "invalid") ? "medium" : sev(c, "medium", "low"),
    effort: "moderate",
    relatedActionType: "update_schema",
  }),
  "aeo.content_depth": (c) => ({
    title: `${plural(n(c, "shallow"), "key page")} ${n(c, "shallow") === 1 ? "doesn't" : "don't"} explain what you offer`,
    whatsWrong: `${n(c, "shallow")} of ${n(c, "total")} key pages (home, services, prices, about…) have under 300 words.`,
    whyItMatters: "Google and AI assistants use these pages to understand your business. If they're thin, they may describe you vaguely or prefer a competitor.",
    howToFix: [
      "On each key page, cover: what you do, who it's for, where you work, price range, how it works, and why customers choose you.",
      "Add a short “Common questions” section with real customer questions.",
      "Include specifics: years in business, number of customers, service areas, certifications.",
    ],
    impact: sev(c, "high", "medium"),
    effort: "involved",
    relatedActionType: "content_brief",
  }),

  "geo.ai_search_access": (c) => ({
    title: "You're blocking AI assistants from reading your site",
    whatsWrong: `${c.detail} These AI robots read pages so tools like ChatGPT and Perplexity can answer questions and link to websites.`,
    whyItMatters: "If they can't read your pages, those tools can't quote you or link to your site — they'll use other websites instead.",
    howToFix: [
      "If you want to appear in AI answers, ask whoever manages your website to unblock the AI robots listed.",
      "You can keep AI training robots (GPTBot, CCBot, Google-Extended) blocked — that's separate.",
      "On WordPress, Yoast and Rank Math let you edit your site's robot rules file under Tools → File editor.",
      `${DEV} in /robots.txt, remove the “Disallow: /” lines under the listed User-agent blocks.`,
    ],
    impact: "high",
    effort: "quick",
    relatedActionType: "robots_review",
  }),
  "geo.ai_training_access": (c) => ({
    title: "You block AI training robots (your choice)",
    whatsWrong: c.detail,
    whyItMatters: "This only affects what future AI models may learn from your site. It does not stop the live AI assistants you allow. There's no right answer — it's your decision.",
    howToFix: [
      "Keep it as it is if you don't want your content used to train AI.",
      "If you'd like AI to learn about your business, unblock those robots in your site's robot rules file.",
      `${DEV} remove the “Disallow” lines for those user-agents in /robots.txt.`,
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "robots_review",
  }),
  "geo.llms_txt": () => ({
    title: "Optional: add an AI guide file",
    whatsWrong: "Your site has no AI guide file — a short text file that points AI assistants to your most important pages.",
    whyItMatters: "This is a new idea. There's no proof yet that the big AI assistants use it, so treat it as a low-priority extra.",
    howToFix: [
      "Start the file with your business name and a one-line description, then list links to your key pages with a sentence each.",
      `${DEV} publish it as a plain-text file at /llms.txt.`,
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "geo.quotable_facts": (c) => ({
    title: "Your pages lack specific facts AI assistants can quote",
    whatsWrong: `Only ${n(c, "withStats")} of ${n(c, "total")} content pages include at least two concrete facts or figures (prices, years, results, percentages).`,
    whyItMatters: "AI assistants tend to quote websites that state clear facts. Vague claims (“best service”) give them nothing to quote.",
    howToFix: [
      "Add real numbers you can stand behind: years in business, customers served, response times, price ranges, results.",
      "Write them as full sentences, e.g. “We've installed over 1,200 solar systems in Kerala since 2015.”",
      "Say where a statistic comes from if it isn't your own.",
    ],
    impact: sev(c, "medium", "medium"),
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "geo.cited_sources": (c) => ({
    title: "Your pages don't back up claims with trusted sources",
    whatsWrong: `Only ${n(c, "citing")} of ${n(c, "total")} content pages link to a trusted source (government, university, research, standards body or major news outlet).`,
    whyItMatters: "Linking to reliable sources shows your content is well researched — a trust sign for readers, Google and AI assistants.",
    howToFix: [
      "When you mention a rule, statistic or study, link to the original source.",
      "Prefer official sources (government sites, industry bodies, research papers) over blogs.",
    ],
    impact: "low",
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
  "geo.freshness": (c) => ({
    title: "Your pages don't show they're up to date",
    whatsWrong: `${n(c, "dated")} of ${n(c, "total")} content pages show a published or “last updated” date, and ${n(c, "recent")} ${n(c, "recent") === 1 ? "was" : "were"} updated in the past year.`,
    whyItMatters: "Google and AI assistants often prefer recent information, especially for prices, rules and comparisons. Without dates they can't tell.",
    howToFix: [
      "Review your key pages and update anything out of date (prices, team, services).",
      "Show a “Last updated: <date>” line on articles and guides.",
      "On WordPress, many themes can show the last-updated date.",
    ],
    impact: sev(c, "medium", "low"),
    effort: "moderate",
    relatedActionType: "update_content",
  }),
  "geo.author_signals": (c) => {
    const missing = n(c, "total") - n(c, "withAuthor");
    return {
      title: `${plural(missing, "article")} ${missing === 1 ? "doesn't" : "don't"} say who wrote ${missing === 1 ? "it" : "them"}`,
      whatsWrong: `Only ${n(c, "withAuthor")} of ${n(c, "total")} articles name an author.`,
      whyItMatters: "Showing real people with real experience makes your content more believable to readers, Google and AI assistants.",
      howToFix: [
        "Add an author name to every article, linked to a short bio page.",
        "In the bio, mention relevant experience, qualifications and a LinkedIn profile.",
        "On WordPress, set each post's author and fill in Users → Profile → Biographical Info.",
      ],
      impact: "medium",
      effort: "quick",
      relatedActionType: "update_content",
    };
  },
  "geo.entity_clarity": (c) => ({
    title: c.facts.hasOrg ? "AI assistants can't easily link your site to your official profiles" : "AI assistants have to guess who your business is",
    whatsWrong: c.facts.hasOrg
      ? `Your business info for Google and AI lists ${plural(n(c, "sameAs"), "official profile")}. This list tells them which social media, LinkedIn, Wikipedia or directory profiles belong to you.`
      : "Your site has no business info for Google and AI — the hidden label that states your business name, logo, website and official profiles. Without it, Google and AI assistants have to piece together who you are.",
    whyItMatters: "AI assistants build a picture of a business from many websites. Linking your website to your official profiles helps them see it's all you, and describe you correctly.",
    howToFix: [
      "On WordPress: Yoast → Settings → Site representation (or Rank Math → Titles & Meta → Local SEO) — choose Organization, then add your name and logo.",
      "Add links to your official profiles (LinkedIn, Facebook, Instagram, YouTube, Google Business Profile, Wikipedia if you have one).",
      "Use exactly the same business name everywhere.",
      `${DEV} add Organization structured data with a sameAs list of profile URLs.`,
    ],
    impact: c.facts.hasOrg ? "medium" : "high",
    effort: "quick",
    relatedActionType: "update_schema",
  }),
  "geo.ai_mention_rate": (c) => ({
    title: "AI assistants rarely name your business",
    whatsWrong: c.detail,
    whyItMatters: "More people now ask ChatGPT, Gemini or Perplexity for recommendations. If you're not named, those customers may never hear of you.",
    howToFix: [
      "Look at the customer questions where you were missing (listed in this report) and make sure your site clearly answers them.",
      "Build pages for the services and places you want to be known for.",
      "Get listed and reviewed on the other websites AI assistants link to most in your market.",
      "Check again after changes; answers vary from one check to the next, so look at the trend.",
    ],
    impact: sev(c, "high", "medium"),
    effort: "involved",
    relatedActionType: "content_brief",
  }),
  "geo.ai_citation_rate": (c) => ({
    title: "AI answers rarely link to your website",
    whatsWrong: c.detail,
    whyItMatters: "When an AI answer links to your page, people can click through to you. It also shows AI sees your site as a reliable source.",
    howToFix: [
      "Make sure AI robots are allowed to read your site.",
      "Publish clear, factual pages that answer the exact questions people ask, with a short direct answer first.",
      "Look at the websites that are linked instead — what do they cover that you don't?",
    ],
    impact: sev(c, "medium", "medium"),
    effort: "involved",
    relatedActionType: "content_brief",
  }),
  "geo.competitor_share": (c) => ({
    title: c.facts.topCompetitor ? `AI names ${String(c.facts.topCompetitor)} more often than you` : "AI rarely names you compared with competitors",
    whatsWrong: c.detail,
    whyItMatters: "When customers ask AI for options, the businesses named most often are the ones they'll consider first.",
    howToFix: [
      "Compare your pages with the competitor's: which topics, comparisons or places do they cover that you don't?",
      "Create honest comparison and “alternatives” pages that explain who you're a good fit for.",
      "Ask happy customers to leave reviews on the websites that matter in your industry.",
    ],
    impact: "medium",
    effort: "involved",
    relatedActionType: "comparison_page_brief",
  }),

  "brand.name_consistency": (c) => ({
    title: "Your business name is missing from key places",
    whatsWrong: c.detail,
    whyItMatters: "Using your business name the same way in headlines and headings helps Google and AI assistants connect your pages to your business.",
    howToFix: [
      "Add your business name to the end of every Google headline, e.g. “Services | Your Business”.",
      "Mention it in your homepage's main heading or first paragraph.",
      "Spell it exactly the same everywhere (website, social media, directories).",
    ],
    impact: sev(c, "medium", "low"),
    effort: "quick",
    relatedActionType: "update_title",
  }),
  "brand.organization_schema": (c) => ({
    title: c.facts.hasOrg ? "Your business info for Google and AI is incomplete" : "Your website doesn't clearly state who you are",
    whatsWrong: c.detail,
    whyItMatters: "This hidden info tells Google and AI assistants your official name, logo and website. Google can use it for the business panel shown in search.",
    howToFix: [
      "On WordPress: Yoast → Settings → Site representation (or Rank Math → Titles & Meta → Local SEO).",
      "Choose “Organization”, enter your exact business name and upload a square logo.",
      "Local businesses: choose “Local business” and add your address, phone and opening hours.",
      `${DEV} add Organization or LocalBusiness structured data with name, logo and url.`,
    ],
    impact: c.facts.hasOrg ? "low" : "medium",
    effort: "quick",
    relatedActionType: "update_schema",
  }),
  "brand.about_page": () => ({
    title: "Visitors can't find out who's behind your business",
    whatsWrong: "We couldn't find an About page linked from your site.",
    whyItMatters: "An About page builds trust with customers and gives Google and AI assistants facts about your business: who you are, where, and since when.",
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
    whyItMatters: "Clear contact details (name, address, phone) build trust, help you show up in local searches, and let AI assistants give people the right details.",
    howToFix: [
      "Add a Contact page linked from your menu.",
      "Make your phone number tap-to-call and your email address clickable.",
      "Make sure your address matches your Google Business Profile exactly.",
      `${DEV} add the address to the Organization/LocalBusiness structured data.`,
    ],
    impact: sev(c, "medium", "low"),
    effort: "quick",
    relatedActionType: "update_content",
  }),
  "brand.privacy_policy": () => ({
    title: "No privacy policy found",
    whatsWrong: "We couldn't find a privacy policy link on your site.",
    whyItMatters: "Visitors expect a privacy policy, and the law often requires one if you collect any personal data (contact forms, visitor tracking). It's also a basic sign of trust.",
    howToFix: [
      "Publish a privacy policy that explains what data you collect and why (WordPress: Settings → Privacy can create a first draft).",
      "Have it checked for your country's rules, then link it in your footer.",
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "internal_task",
  }),
  "brand.social_profiles": (c) => ({
    title: n(c, "platforms") ? "Link to more of your social media profiles" : "Your site doesn't link to your social media profiles",
    whatsWrong: c.detail,
    whyItMatters: "Linking to your official profiles helps people check you're real, and helps AI assistants connect your business across the web.",
    howToFix: [
      "Add icons linking to your active profiles (LinkedIn, Instagram, Facebook, YouTube…) in the footer.",
      `${DEV} add the same profile URLs to the Organization structured data's sameAs list.`,
    ],
    impact: "low",
    effort: "quick",
    relatedActionType: "update_content",
  }),
  "brand.ai_recommendation": (c) => ({
    title: "AI assistants rarely recommend your business",
    whatsWrong: c.detail,
    whyItMatters: "Being named is good; being recommended is what turns AI answers into customers.",
    howToFix: [
      "Spell out your strengths on your site: who you're best for, results, warranties you actually offer, awards, reviews.",
      "Collect reviews on the websites that AI answers link to in your market.",
      "Answer “best X for Y” questions honestly on your own pages.",
    ],
    impact: sev(c, "high", "medium"),
    effort: "involved",
    relatedActionType: "content_brief",
  }),
  "brand.ai_knowledge": (c) => ({
    title: n(c, "inaccuracies") ? "AI assistants say wrong things about your business" : "Some AI assistants don't know your business",
    whatsWrong: `${c.detail}${c.evidence ? ` For example — ${c.evidence}` : ""}`,
    whyItMatters: "People increasingly trust what AI assistants tell them. Wrong or missing information can send customers elsewhere.",
    howToFix: [
      "Make sure your About, Contact and service pages state the correct facts plainly.",
      "Update the same facts on your Google Business Profile, LinkedIn and key directories.",
      "Add business info for Google and AI that links to your official profiles, so the facts connect back to you.",
    ],
    impact: n(c, "inaccuracies") ? "high" : "medium",
    effort: "moderate",
    relatedActionType: "content_brief",
  }),
};

const STRENGTHS: Record<string, string> = {
  "seo.indexability": "Your pages load correctly and can appear on Google.",
  "seo.titles": "Every page has its own clear Google headline.",
  "seo.meta_description": "Your pages have their own Google summary.",
  "seo.h1": "Each page has one clear main heading.",
  "seo.broken_links": "No broken links between your pages.",
  "seo.sitemap": "You have a page list that helps Google find your pages.",
  "seo.https": "Your site is secure (padlock in the browser).",
  "seo.mobile_viewport": "Your pages are set up for phones.",
  "seo.thin_content": "Your pages have real substance.",
  "seo.duplicate_content": "Your pages each have their own text.",
  "seo.canonical": "Your pages say which version is the main one.",
  "aeo.question_headings": "Your pages are built around real customer questions.",
  "aeo.direct_answers": "You give short, direct answers that AI assistants can quote.",
  "aeo.faq_schema": "Your questions and answers are labelled for Google and AI.",
  "aeo.structured_data": "Your pages include info for Google and AI.",
  "aeo.content_depth": "Your key pages explain what you offer in depth.",
  "aeo.readability": "Your writing is easy to read.",
  "geo.ai_search_access": "AI assistants are free to read your site.",
  "geo.quotable_facts": "Your pages include concrete facts and figures AI assistants can quote.",
  "geo.cited_sources": "You back up your content with trusted sources.",
  "geo.freshness": "Your pages are dated and recently updated.",
  "geo.author_signals": "Your articles name their authors.",
  "geo.entity_clarity": "Your business is clearly linked to your official profiles.",
  "geo.ai_mention_rate": "AI assistants name your business often in the answers we checked.",
  "geo.ai_citation_rate": "AI answers often link to your website.",
  "geo.competitor_share": "AI names you more often than your competitors in the answers we checked.",
  "brand.name_consistency": "Your business name is used the same way across your pages.",
  "brand.organization_schema": "Your business details and logo are set up for Google and AI.",
  "brand.about_page": "You have an About page.",
  "brand.contact_info": "Your contact details are easy to find.",
  "brand.privacy_policy": "You publish a privacy policy.",
  "brand.social_profiles": "You link to your social media profiles.",
  "brand.ai_recommendation": "AI assistants recommend your business in many answers.",
  "brand.ai_knowledge": "AI assistants know your business and describe it correctly.",
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
    whatsWrong: "Your pages don't have a language setting.",
    whyItMatters: "It helps Google show your pages to people who speak that language, and helps screen readers pronounce the text correctly.",
    howToFix: ["Set your site language (WordPress: Settings → General → Site Language) — most themes then add it automatically.", `${DEV} add a lang attribute to the <html> tag.`],
    effort: "quick",
    relatedActionType: "internal_task",
  },
  heading_level_skip: {
    pillar: "seo",
    title: "Your headings jump levels",
    whatsWrong: "Some pages jump from a big heading straight to a much smaller one (e.g. Heading 1 → Heading 4), which muddles the page layout.",
    whyItMatters: "Headings in order help screen readers, Google and AI assistants see how the sections fit together.",
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
          whyItMatters: "Our website check found this. It can make your pages harder for Google or AI assistants to read.",
          howToFix: ["Open the listed pages and look at the problem described.", "If you're unsure, share this item with your web developer."],
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

/** The one 3-level scale shown to people for a problem (docs/PLAIN_WORDS.md). Same words on To-do, Report and Home. */
export const IMPACT_LABEL: Record<IssueImpact, string> = { high: "Urgent", medium: "Important", low: "Nice to have" };

/**
 * Open-problem counts for history snapshots, from the same grouped problem list the report and To-do show
 * (one row per problem, not one per page). Urgent → high, Important → medium, Nice to have → low.
 */
export function issueCounts(issues: Pick<ReportIssue, "impact">[]): { critical: number; high: number; medium: number; low: number; info: number; total: number } {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: issues.length };
  for (const i of issues) counts[i.impact] += 1;
  return counts;
}
