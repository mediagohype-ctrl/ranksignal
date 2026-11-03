// "Easy to quote" guides (aeo.*): question headings, direct answers, Q&A labels, lists/tables, readability,
// info for Google and AI, and depth of key pages.
import type { FixGuide, FixPage } from "../../types";
import { clip, isHome, pageName, topicOf } from "../../helpers";
import {
  ADD_SECTION, CHECK_CODE, MAKE_HEADING, MAKE_LIST, OPEN_PAGE, PASTE_ONE_PAGE, PASTE_SITE_WIDE, PUBLISH,
  lower, perPlatform, wordsOf,
} from "./shared";

const path = (p: FixPage) => {
  try {
    return new URL(p.url).pathname.toLowerCase();
  } catch {
    return "";
  }
};

type Kind = "home" | "about" | "contact" | "pricing" | "faq" | "blog" | "product" | "service" | "other";
function kindOf(p: FixPage): Kind {
  if (isHome(p.url)) return "home";
  const u = path(p);
  if (/\/(about|about-us|who-we-are|our-story|company|team)(\/|$)/.test(u)) return "about";
  if (/\/(contact|contact-us|locations?|find-us)(\/|$)/.test(u)) return "contact";
  if (/\/(pricing|prices|plans|rates|fees|cost)/.test(u)) return "pricing";
  if (/\/(faq|faqs|questions|help)(\/|$)/.test(u)) return "faq";
  if (/\/(blog|news|articles?|posts?|guides?|insights|resources)\//.test(u)) return "blog";
  if (/\/(products?|shop|store|collections)\//.test(u)) return "product";
  if (/\/(services?|solutions|what-we-do|treatments|offer)/.test(u)) return "service";
  return "other";
}

// ---------------------------------------------------------------------------------------------------------------

export const questionHeadingsGuide: FixGuide = {
  effect: (ctx) =>
    `${ctx.issue.affectedCount} of your content pages have no headings written as questions, so when someone asks Google or an AI assistant "How much…?" or "How long…?", nothing on those pages matches the question directly.`,
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const t = lower(topicOf(p, ctx.brand));
      const k = kindOf(p);
      const qs =
        k === "home"
          ? [`What does ${ctx.brand} do?`, "Which areas do you cover?", "How do I get a price?"]
          : k === "about"
            ? [`Who is behind ${ctx.brand}?`, "How long have you been in business?", "Are you qualified / certified?"]
            : k === "contact"
              ? ["What are your opening hours?", "How quickly do you reply?", "Which areas do you cover?"]
              : k === "pricing"
                ? ["How much does it cost?", "What's included in the price?", "Are there any extra fees?"]
                : [`How much does ${t} cost?`, `How long does ${t} take?`, `Why choose ${ctx.brand} for ${t}?`];
      const n = p.extracted?.headings.filter((h) => h.level >= 2).length ?? 0;
      return {
        page: pageName(p.url),
        now: n ? `${n} subheading${n === 1 ? "" : "s"}, none written as a question` : "No subheadings",
        change: `Add questions like: ${qs.map((q) => `"${q}"`).join(", ")}`,
      };
    }),
  steps: perPlatform((p) => [
    "Write down the 5–10 questions customers really ask you — look in emails, calls, reviews and the \"People also ask\" box when you search for your service on Google.",
    OPEN_PAGE[p],
    "Add 2–4 of those questions to the page as subheadings, in the customer's own words: \"How much does a boiler service cost?\", not \"Our pricing\". The 'Change it to' column has ideas for each page.",
    MAKE_HEADING[p],
    "Answer each question in the first 1–2 sentences right under it, then add the detail.",
    ...(p === "wordpress" ? ["Don't fake a heading with bold or bigger text — it has to be a real Heading block so Google and AI can see it's a question."] : []),
    ...(p === "shopify" ? ["On product pages, many themes have a \"Collapsible content\" block (Customize → product template → Add block) that's ideal for questions — write each question as the block's heading."] : []),
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "Add question-style <h2>/<h3> headings (customer wording, ending with '?') to the listed pages, each immediately followed by a <p> answering it in 40–60 words. They must be in the server-rendered HTML: not only in client components that fetch text after load, and not in accordions that don't render the answer until clicked (use <details>/<summary> or render hidden content). If the content comes from a CMS/MDX, add it there.",
    react:
      "Add question-style <h2>/<h3> headings with a 40–60 word <p> answer right after each. This is a client-side SPA, so also make sure the routes are pre-rendered (vite-react-ssg / vite-plugin-prerender / react-snap) or crawlers that don't run JavaScript won't see them.",
    custom: "In each listed page's template, add question-style <h2>/<h3> headings followed directly by a 40–60 word <p> answer, in the server-sent HTML.",
  },
  verify: [
    "Open each page and check the questions show as headings (bigger text, on their own line).",
    "Click \"Check website\" on Home. The number of pages with question headings should go up.",
  ],
  time: "15–20 minutes per page",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

export const directAnswersGuide: FixGuide = {
  effect: (ctx) =>
    `Google and AI assistants like to quote a short answer that makes sense on its own. On ${ctx.issue.affectedCount === 1 ? "this page" : `these ${ctx.issue.affectedCount} pages`} the answer to each question is missing, too long or buried, so they're likely to quote another website instead.`,
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const qs = p.extracted?.questionHeadings ?? [];
      const answered = p.extracted?.questionsWithConciseAnswer ?? 0;
      return {
        page: pageName(p.url),
        now: qs.length ? `${qs.length} question heading${qs.length === 1 ? "" : "s"}, ${answered} with a short answer` : "No questions answered",
        change: qs.length
          ? `Under "${clip(qs[0], 60)}"${qs.length > 1 ? ` (and the other ${qs.length - 1})` : ""}, start with a 40–60 word answer that stands on its own`
          : `Add 2–3 customer questions about ${lower(topicOf(p, ctx.brand))}, each with a 40–60 word answer`,
      };
    }),
  steps: perPlatform((p) => [
    OPEN_PAGE[p],
    "Find each question heading on the page (see the list above).",
    "Directly under it — before any picture, button or long story — write 2–3 sentences (about 40–60 words) that answer it completely on their own.",
    "Start by repeating the subject and give the answer straight away. Example: under \"How long does installation take?\" write \"Most installations by <Brand> take one day. We arrive at 8am, finish by 5pm and remove all old equipment.\"",
    "Include the exact fact people want: a price range, a time, a yes or no, a place.",
    "Put extra detail, steps or examples after the short answer, not before it.",
    ...(p === "nextjs" || p === "react" || p === "custom"
      ? ["If answers sit in an accordion, the answer text must still be in the page's HTML when it loads (e.g. `<details>`/`<summary>`), not fetched when someone clicks."]
      : []),
    ...(p === "wordpress" ? ["If you use the Yoast FAQ or Rank Math FAQ block, put the short answer first in each answer box."] : []),
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "For every question heading (<h2>/<h3> ending in '?') on the listed pages, make the very next element a <p> of 40–60 words that answers it completely and repeats the subject. Move longer explanations below. Answers inside accordions must be server-rendered in the HTML (e.g. <details>), not loaded on click.",
    react:
      "For every question heading, make the next element a 40–60 word <p> answer. Ensure the routes are pre-rendered so the answers are in the HTML crawlers download.",
    custom: "For every question heading, make the next element a 40–60 word <p> that answers it on its own; put longer detail after it.",
  },
  verify: [
    "Read each answer on its own, without the rest of the page. If it still makes sense and answers the question, it's right.",
    "Click \"Check website\" on Home. More of your questions should count as answered.",
  ],
  time: "10 minutes per question (about 1 hour in total)",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

const FAQ_HONEST =
  "Good to know: Google now shows the expandable question extras in search only for a few kinds of sites (mainly government and health), so do this to help Google and AI read your answers correctly — not to get a bigger listing.";
const FAQ_SAME = "Label only questions and answers that are visible on the page, with exactly the same wording. If you change an answer later, change the code too.";
const FAQ_WRITE =
  "Ask the AI prompt below (or ChatGPT) to write FAQ code from the exact questions and answers on the page. It starts with `<script type=\"application/ld+json\">`.";

export const faqSchemaGuide: FixGuide = {
  effect: (ctx) =>
    `${ctx.issue.affectedCount === 1 ? "One page has" : `${ctx.issue.affectedCount} pages have`} questions and answers, but nothing tells Google and AI "this is a question, this is its answer", so they have to guess where each answer starts and ends.`,
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const qs = p.extracted?.questionHeadings ?? p.extracted?.headings.filter((h) => h.level >= 2 && h.text.trim().endsWith("?")).map((h) => h.text) ?? [];
      return {
        page: pageName(p.url),
        now: qs.length ? `${qs.length} questions, not labelled` : "Questions not labelled",
        change: qs.length
          ? `Label these ${qs.length} questions, e.g. ${qs.slice(0, 2).map((q) => `"${clip(q, 50)}"`).join(", ")}`
          : "Label each question and its answer",
      };
    }),
  steps: {
    nextjs: [
      FAQ_HONEST,
      "In the page's `page.tsx`, keep the questions and answers in one list, e.g. `const faqs = [{ q: \"…\", a: \"…\" }]`, and show them on the page from that list — then the page and the labels always match.",
      "In the same server file add `<script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify({ \"@context\": \"https://schema.org\", \"@type\": \"FAQPage\", mainEntity: faqs.map((f) => ({ \"@type\": \"Question\", name: f.q, acceptedAnswer: { \"@type\": \"Answer\", text: f.a } })) }) }} />`.",
      "Don't put this in a `\"use client\"` component or load it with `next/script` — it must be in the HTML the server sends.",
      FAQ_SAME,
      PUBLISH.nextjs,
      CHECK_CODE,
    ],
    react: [
      FAQ_HONEST,
      "Keep the questions and answers in one array in the page component and render them from it.",
      PASTE_ONE_PAGE.react,
      "Build the FAQ code from the same array: `{ \"@context\": \"https://schema.org\", \"@type\": \"FAQPage\", mainEntity: faqs.map((f) => ({ \"@type\": \"Question\", name: f.q, acceptedAnswer: { \"@type\": \"Answer\", text: f.a } })) }`.",
      FAQ_SAME,
      PUBLISH.react,
      CHECK_CODE,
    ],
    wordpress: [
      FAQ_HONEST,
      "Edit the page. With Yoast: click + → search \"Yoast FAQ\" → add the block and move each question and answer into it (Add question). With Rank Math: click + → \"FAQ by Rank Math\".",
      "These blocks add the labels for you — no code. Delete the old plain-text copy of the questions so they aren't on the page twice.",
      "Using Elementor? Its Accordion and Toggle widgets have a `FAQ Schema` switch in the widget settings — turn it on instead.",
      "Use only one method per page (one FAQ block or one widget), or Google may see the questions twice.",
      PUBLISH.wordpress,
      CHECK_CODE,
    ],
    shopify: [
      FAQ_HONEST,
      "Easiest: use an FAQ app from the Shopify App Store whose description says it adds FAQ info for Google (often called rich snippets or structured data), and move your questions into it.",
      "Or do it yourself: " + FAQ_WRITE,
      PASTE_ONE_PAGE.shopify,
      FAQ_SAME,
      CHECK_CODE,
    ],
    wix: [
      FAQ_HONEST,
      FAQ_WRITE,
      PASTE_ONE_PAGE.wix + " (If Wix shows an error about the `<script>` tags, remove them and paste only the part from the first `{` to the last `}`.)",
      FAQ_SAME,
      PUBLISH.wix,
      CHECK_CODE,
    ],
    webflow: [
      FAQ_HONEST,
      FAQ_WRITE,
      PASTE_ONE_PAGE.webflow,
      "If your questions are in a CMS collection (one item per question), ask your developer to output them on the page with a short script, or label just your most important FAQ page by hand.",
      FAQ_SAME,
      CHECK_CODE,
    ],
    framer: [FAQ_HONEST, FAQ_WRITE, PASTE_ONE_PAGE.framer, FAQ_SAME, CHECK_CODE],
    squarespace: [
      FAQ_HONEST,
      FAQ_WRITE,
      PASTE_ONE_PAGE.squarespace + " Page code injection needs a Core / Business plan or higher.",
      FAQ_SAME,
      CHECK_CODE,
    ],
    custom: [
      FAQ_HONEST,
      "Add a `<script type=\"application/ld+json\">` block to each listed page with `\"@type\": \"FAQPage\"` and one `Question` (with its `acceptedAnswer`) for every question shown on the page.",
      "Generate it from the same data that prints the questions, so they never drift apart.",
      FAQ_SAME,
      CHECK_CODE,
    ],
  },
  promptHints: {
    nextjs:
      "Add FAQPage JSON-LD to the listed pages: a server-rendered <script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, \"\\u003c\") }} /> in page.tsx (not \"use client\", not next/script). Build mainEntity (Question → acceptedAnswer Answer) from the same array that renders the visible Q&A so they always match. Only include questions visible on the page.",
    react:
      "Add FAQPage JSON-LD per page built from the same array that renders the Q&A (react-helmet-async or React 19 hoisted <script>). Pre-render the routes so the JSON-LD is in the static HTML.",
    custom: "Add FAQPage JSON-LD (mainEntity: Question/acceptedAnswer) to each listed page's server-sent HTML, generated from the same data as the visible questions.",
  },
  verify: [
    "Open Google's Rich Results Test (search.google.com/test/rich-results), enter each page address: it should find an FAQ item with no errors (it may say the page isn't eligible for extras — that's fine).",
    "Click \"Check website\" on Home. This problem should disappear from your list.",
  ],
  time: "15–30 minutes per page",
  category: "technical",
};

// ---------------------------------------------------------------------------------------------------------------

const LIST_IDEA: Record<Kind, string> = {
  home: "Bullet list of your main services, plus \"How it works\" in 3 numbered steps",
  about: "Bullet list of key facts: founded, areas served, team size, qualifications",
  contact: "Bullet list of opening hours, areas covered and ways to reach you",
  pricing: "Table of plans or services: name / what's included / price",
  faq: "Numbered steps inside answers that explain a process",
  blog: "Numbered steps for any process, and a small table if you compare options",
  product: "Bullet list of key features and a table of sizes, specs or options",
  service: "Bullet list of what's included, numbered \"How it works\" steps, and a price table",
  other: "Turn any steps into a numbered list and any features into bullet points",
};

export const listsTablesGuide: FixGuide = {
  effect: (ctx) =>
    `${ctx.issue.affectedCount} of your pages are long paragraphs only. Google and AI assistants often lift lists ("5 steps to…") and tables (prices, comparisons) straight into answers — these pages give them nothing to lift.`,
  changes: (ctx) =>
    ctx.pages.map((p) => ({
      page: pageName(p.url),
      now: `No lists or tables (${wordsOf(p)} words of paragraphs)`,
      change: LIST_IDEA[kindOf(p)],
    })),
  steps: perPlatform((p) => [
    OPEN_PAGE[p],
    "Look for text that is really a list: steps, features, what's included, areas you cover, opening hours, prices or options.",
    MAKE_LIST[p],
    "Give each list or table a short heading above it (e.g. \"What's included\", \"Prices\", \"How it works in 3 steps\") and a one-line sentence that introduces it.",
    "Keep each bullet short — one idea, under about 15 words.",
    "Don't use pictures of tables or price lists: Google and AI can't reliably read words inside images.",
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "On the listed pages, convert step sequences to <ol>, feature/inclusion lists to <ul>, and price/plan/comparison content to semantic <table> with <thead>/<th>. Use real HTML elements (not styled divs) in server-rendered markup, each under a descriptive <h2>/<h3>.",
    react: "Convert steps to <ol>, features to <ul>, prices/comparisons to semantic <table>. Ensure routes are pre-rendered so this is in the HTML.",
    custom: "Use semantic <ol>/<ul>/<li> and <table>/<th> in the page templates instead of paragraphs or div grids, each under a descriptive heading.",
  },
  verify: [
    "Open each page: you should see at least one bullet list, numbered list or table.",
    "Click \"Check website\" on Home. This problem should disappear from your list.",
  ],
  time: "10–15 minutes per page",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

export const readabilityGuide: FixGuide = {
  effect: (ctx) =>
    `${ctx.issue.affectedCount === 1 ? "One page is" : `${ctx.issue.affectedCount} pages are`} hard to read. Long sentences and trade words make visitors leave, and make it harder for AI assistants to quote you correctly.`,
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const x = p.extracted;
      const score = typeof x?.readingEase === "number" ? Math.round(x.readingEase) : null;
      const wps = x?.sentenceCount ? Math.round((x.contentWordCount ?? x.wordCount) / x.sentenceCount) : null;
      return {
        page: pageName(p.url),
        now: `${score === null ? "Hard to read" : `Reading score ${score} of 100`}${wps ? ` (about ${wps} words per sentence)` : ""}`,
        change: `Aim for 50 or more: sentences under 20 words${wps && wps > 20 ? ` (split most sentences in two)` : ""}, everyday words, short paragraphs`,
      };
    }),
  steps: perPlatform((p) => [
    OPEN_PAGE[p],
    "Paste the page's text into a free tool such as hemingwayapp.com (or Microsoft Word → Editor → Insights / Readability) to see the hardest sentences highlighted.",
    "Split long sentences: aim for under 20 words each, one idea per sentence.",
    "Swap trade words for everyday ones (\"utilise\" → \"use\", \"commence\" → \"start\"), or explain a term the first time: \"a combi boiler (one unit that heats water when you need it)\".",
    "Use short paragraphs of 2–4 sentences, put the main point first, and talk to the reader as \"you\".",
    ...(p === "wordpress" ? ["Yoast shows a Readability check in the editor (the traffic-light icon) that flags long sentences and paragraphs as you type."] : []),
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "Rewrite the visible copy on the listed pages (in the page components, MDX or CMS) for a Flesch reading ease of 50+: sentences under ~20 words, plain words, 2–4 sentence paragraphs, main point first. Keep the meaning, facts, headings and keywords. Show before/after per section.",
    react: "Rewrite the visible copy on the listed routes for a Flesch reading ease of 50+ (short sentences, plain words, short paragraphs). Keep facts and headings.",
    custom: "Rewrite the visible copy on the listed pages for a Flesch reading ease of 50+ (short sentences, plain words, short paragraphs). Keep facts and headings.",
  },
  verify: [
    "Paste the new text into hemingwayapp.com: most sentences should be white or yellow, not red.",
    "Click \"Check website\" on Home. The reading score for these pages should go up.",
  ],
  time: "20–30 minutes per page",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

const isInvalid = (j: unknown) => typeof j === "object" && j !== null && (j as Record<string, unknown>)["@invalid"] === true;

const TYPE_IDEA: Record<Kind, string> = {
  home: "Business info (Organization, or LocalBusiness if customers visit or you serve an area) + WebSite",
  about: "AboutPage + business info (Organization)",
  contact: "LocalBusiness with address, phone and opening hours",
  pricing: "Service or Product with prices (Offer)",
  faq: "FAQPage with each question and answer",
  blog: "BlogPosting with headline, author, date published and date updated",
  product: "Product with price, availability and reviews",
  service: "Service with name, area served and provider: your business",
  other: "WebPage + BreadcrumbList",
};

export const structuredDataGuide: FixGuide = {
  effect: (ctx) =>
    `${ctx.issue.affectedCount} of your pages have no working info for Google and AI (hidden labels that say "this is a business / product / article, here are the facts"), so they have to guess.`,
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const x = p.extracted;
      const broken = !!x?.jsonLd.some(isInvalid);
      const types = x?.schemaTypes ?? [];
      return {
        page: pageName(p.url),
        now: broken ? `Broken (can't be read)${types.length ? `: ${types.slice(0, 3).join(", ")}` : ""}` : types.length ? types.slice(0, 3).join(", ") : "None",
        change: broken ? `Fix the broken code (usually a missing comma or quote), then: ${TYPE_IDEA[kindOf(p)]}` : TYPE_IDEA[kindOf(p)],
      };
    }),
  steps: {
    nextjs: [
      "Start with the whole site: add your business info (Organization or LocalBusiness) once in `app/layout.tsx`. The 'Change it to' column says what each page needs.",
      ...PASTE_SITE_WIDE.nextjs.slice(1),
      "For each type of page, build the info in its server `page.tsx` from the same data the page shows — a post's title, author and dates for `BlogPosting`, a product's price for `Product`.",
      "Fix broken blocks first: they're usually hand-written strings with a missing comma or quote. Build plain objects and use `JSON.stringify` instead.",
      "Optional: the `schema-dts` package type-checks these objects so mistakes show up before you deploy.",
      PUBLISH.nextjs,
      CHECK_CODE,
    ],
    react: [
      "Put your business info (Organization or LocalBusiness) in a `<script type=\"application/ld+json\">` inside `<head>` in `index.html` — every robot sees that part.",
      "Page-specific info (articles, products, FAQ) must be added per page, e.g. with react-helmet-async, and the pages pre-rendered (vite-react-ssg, react-snap) so robots that don't run JavaScript see it.",
      "Fix broken blocks first: build objects in code and use `JSON.stringify` instead of hand-written text.",
      PUBLISH.react,
      CHECK_CODE,
    ],
    wordpress: [
      "Install Yoast SEO or Rank Math if you don't have one (Plugins → Add New Plugin → search → Install → Activate). Both add basic info for Google and AI to every page automatically.",
      "Yoast: Yoast SEO → Settings → Site representation — fill in your business name, logo and profiles. Rank Math: Rank Math → Titles & Meta → Local SEO.",
      "Set the right type for each kind of content: Yoast → Settings → Content types → Posts / Pages (the `Schema` section); Rank Math → Titles & Meta → Posts / Pages → `Schema Type`. Posts: Article or Blog Post. Pages: Web Page.",
      "Products: WooCommerce adds product info automatically. For a single service page, Rank Math's `Schema` tab in the page editor lets you add Service or Local Business.",
      "Broken info usually comes from a second SEO plugin or old code pasted into the theme. Keep only one SEO plugin active and remove old hand-pasted code (WPCode snippets, or Appearance → Theme File Editor → `header.php`).",
      CHECK_CODE,
    ],
    shopify: [
      "Most Shopify themes already add product and store info. Test a product page and your home page with Google's Rich Results Test first (search.google.com/test/rich-results).",
      "Broken or doubled info usually comes from an old theme or two apps adding the same thing. Remove apps you no longer use (Settings → Apps and sales channels) and keep only one SEO app.",
      "For fuller info (business details, breadcrumbs, articles), install one well-reviewed app from the Shopify App Store that adds it automatically — search for `JSON-LD`.",
      "Or add your business info code yourself (the AI prompt below writes it with your details):",
      ...PASTE_SITE_WIDE.shopify,
      CHECK_CODE,
    ],
    wix: [
      "Wix adds basic info for Google and AI to many pages automatically (products, blog posts, events). Fill in Settings → Business Info so it's correct.",
      "For other pages: Pages & Menu → hover the page → ⋯ → SEO basics → Advanced SEO → Structured data markup → + Add New Markup.",
      "Paste the code for that page (the AI prompt below writes it from the 'Change it to' column) and click Apply. Wix warns you if the code isn't valid.",
      "To fix broken code, open the same panel, click the existing markup and correct or delete it.",
      PUBLISH.wix,
      CHECK_CODE,
    ],
    webflow: [
      "Webflow doesn't add this info for you. Add your business info once for the whole site:",
      ...PASTE_SITE_WIDE.webflow,
      "For one page: " + PASTE_ONE_PAGE.webflow,
      "For CMS pages (blog posts, services), paste the code in the CMS template page's settings and use + Add Field to insert each item's name, date and image, so every item gets its own info.",
      "Fix broken code: paste it into `validator.schema.org` to find the missing comma or quote.",
      CHECK_CODE,
    ],
    framer: [
      "Framer doesn't add this info for you. Add your business info once for the whole site:",
      ...PASTE_SITE_WIDE.framer,
      "For one page: " + PASTE_ONE_PAGE.framer,
      "CMS pages share one page's custom code, so only add info there that's true for every item (like your business info).",
      CHECK_CODE,
    ],
    squarespace: [
      "Squarespace adds basic business info automatically from Settings → Business information — fill in your name, address, phone and hours there first. Blog posts and products get basic info automatically too.",
      "For more on one page (a Service or FAQ): " + PASTE_ONE_PAGE.squarespace,
      "For the whole site: Settings → Advanced → Code Injection → Header. Both need a Core / Business plan or higher.",
      "The AI prompt below writes the code for each page from the 'Change it to' column.",
      CHECK_CODE,
    ],
    custom: [
      "Add a `<script type=\"application/ld+json\">` block to each page type's template: business info (Organization or LocalBusiness) on every page, plus Article, Product, Service or FAQPage where they fit (see 'Change it to').",
      "Generate it from the same data that the page shows, so it never goes out of date.",
      "Fix broken blocks first — one missing comma makes the whole block unreadable.",
      "Make sure the block is in the HTML the server sends, not only added later by JavaScript.",
      CHECK_CODE,
    ],
  },
  promptHints: {
    nextjs:
      "Add JSON-LD as server-rendered <script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, \"\\u003c\") }} /> (not next/script, not in \"use client\" components). Organization/LocalBusiness (name, url, logo, sameAs, address/telephone if local) in app/layout.tsx; per-route types in page.tsx built from the page's own data (BlogPosting with author/datePublished/dateModified, Product with offers, Service, FAQPage, BreadcrumbList). Fix any hand-written invalid JSON by building objects. Optionally type with schema-dts. Validate with the Rich Results Test.",
    react:
      "Put Organization/LocalBusiness JSON-LD statically in index.html <head>. Add per-route JSON-LD via react-helmet-async and pre-render routes (vite-react-ssg / vite-plugin-prerender / react-snap) so it's in static HTML. Replace any invalid hand-written JSON with JSON.stringify of objects.",
    custom:
      "Add JSON-LD blocks to the page templates in server-sent HTML: Organization/LocalBusiness site-wide; Article/BlogPosting, Product, Service, FAQPage, BreadcrumbList per page type, generated from the page's data. Fix invalid JSON first. Validate with the Rich Results Test and validator.schema.org.",
  },
  verify: [
    "Open Google's Rich Results Test (search.google.com/test/rich-results) and enter each page address. It should list the info you added, with no errors.",
    "Click \"Check website\" on Home. More pages should count as having info for Google and AI, and none as broken.",
  ],
  time: "1–2 hours (less on WordPress with Yoast or Rank Math)",
  category: "technical",
};

// ---------------------------------------------------------------------------------------------------------------

const DEPTH_IDEA: Record<Kind, string> = {
  home: "what <brand> does, who for, where, prices from, how it works, why choose you, 3 common questions",
  about: "your story, the people (names, roles, qualifications), years in business, areas served, awards",
  contact: "areas you cover, opening hours, how fast you reply, how to find you",
  pricing: "each price explained, what's included, what changes the price, common questions",
  faq: "more questions with a short answer each",
  blog: "the full answer to the post's question with steps, examples and facts",
  product: "what it is, who it's for, key features, sizes/specs, delivery and returns",
  service: "what's included, who it's for, where, price range, how long it takes, how it works, common questions",
  other: "what the page is about, who it's for, the key facts, and common questions",
};

export const contentDepthGuide: FixGuide = {
  effect: (ctx) =>
    `Google and AI assistants use your key pages to understand ${ctx.brand}. ${ctx.issue.affectedCount === 1 ? "One of them is" : `${ctx.issue.affectedCount} of them are`} too thin, so they may describe you vaguely or recommend a competitor whose pages explain more.`,
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const w = wordsOf(p);
      return {
        page: pageName(p.url),
        now: w === 0 ? "No text found (may only appear after JavaScript runs)" : `${w} words`,
        change:
          w === 0
            ? "Make sure the words are in the page itself, then aim for 400+ words"
            : `Add about ${Math.max(150, 400 - w)} words: ${DEPTH_IDEA[kindOf(p)].replace("<brand>", ctx.brand)}`,
      };
    }),
  steps: perPlatform((p) => [
    OPEN_PAGE[p],
    "Use this checklist, one short section with a subheading each: what you offer (one plain sentence first) · who it's for · where you work · prices or a price range · how it works (3–5 steps) · why customers choose <Brand> (years, jobs done, reviews, certifications) · 3–5 common questions.",
    ADD_SECTION[p],
    "Write it the way you'd explain it to a customer on the phone. Aim for 400–800 words on key pages — real detail, not filler.",
    "Keep the words as real text: not inside images, sliders or videos.",
    ...(p === "nextjs" || p === "react" ? ["If the page showed 0 words, its text only appears after JavaScript runs in the browser — render it on the server (Next.js) or pre-render it (React) so robots see it."] : []),
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "Expand the listed key pages to 400–800 words of server-rendered copy with <h2> sections: offer summary, audience, service area, pricing/price range, process (<ol>), proof (years, numbers, reviews, certifications) and 3–5 FAQs (question <h2>/<h3> + 40–60 word answer). If a page reported 0 words, its content is client-rendered — move data fetching to the server component so the text is in the initial HTML. Leave placeholders like [YEARS] where facts are unknown; don't invent facts.",
    react:
      "Expand the listed pages to 400–800 words with headed sections (offer, audience, area, prices, process, proof, FAQs). Pages with 0 words are client-rendered — set up pre-rendering so the text is in static HTML. Use placeholders for unknown facts.",
    custom: "Expand the listed key pages to 400–800 words of server-sent HTML with headed sections (offer, audience, area, prices, process, proof, FAQs). Use placeholders for unknown facts; don't invent them.",
  },
  verify: [
    "Read each page as a new customer: could you say what the business does, where, for whom and roughly what it costs?",
    "Click \"Check website\" on Home. These pages should no longer be listed as thin.",
  ],
  time: "45–60 minutes per page",
  category: "content",
};
