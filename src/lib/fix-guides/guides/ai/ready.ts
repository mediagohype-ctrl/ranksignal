// "Ready for AI" guides (geo.* website checks): AI robot access, the optional AI guide file, quotable facts,
// trusted sources, dates, authors and whether AI can identify the business.
import type { FixGuide } from "../../types";
import { isHome, pageName, topicOf } from "../../helpers";
import { ADD_LINK, OPEN_PAGE, PUBLISH, lower, perPlatform } from "./shared";
import { orgSteps, ORG_HINTS } from "./org";

// ---------------------------------------------------------------------------------------------------------------

const SEARCH_BOTS = "OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User and Claude-SearchBot";
const DELETE_LINES =
  "Delete the `User-agent:` line for each blocked AI search robot and the `Disallow: /` line under it (or change it to `Allow: /`).";
const EVERYONE =
  "If you see `User-agent: *` followed by `Disallow: /`, that blocks every robot, Google included — remove that line unless the site is meant to be private.";
const TRAINING_OK =
  "You can keep AI training robots (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended) blocked — that's a separate business choice and doesn't stop live AI answers.";
const CLOUDFLARE =
  "If your site uses Cloudflare, open your domain in the Cloudflare dashboard → Security → Bots (or AI Crawl Control) and check the \"Block AI bots\" setting and the option that manages your robot rules file for you — they can block AI robots even when your own file is fine.";

export const aiSearchAccessGuide: FixGuide = {
  effect: () =>
    "Your robot rules file tells AI search robots to stay away, so ChatGPT search, Perplexity and Claude can't read your pages for live answers — they'll quote and link other websites instead.",
  changes: (ctx) => [
    {
      page: "/robots.txt",
      now: ctx.issue.evidence ?? "Blocks AI search robots",
      change: `Allow ${SEARCH_BOTS} (training robots can stay blocked if you prefer)`,
    },
  ],
  steps: {
    nextjs: [
      "In your project, look for `app/robots.ts` (or `app/robots.txt`, or `public/robots.txt`). That is your robot rules file — keep only one of them.",
      `In \`app/robots.ts\`, delete the \`rules\` entries whose \`userAgent\` lists any of ${SEARCH_BOTS} with \`disallow: "/"\`.`,
      "A simple open version: `export default function robots() { return { rules: [{ userAgent: \"*\", allow: \"/\" }], sitemap: \"https://yoursite.com/sitemap.xml\" } }`. To keep AI training out, add `{ userAgent: [\"GPTBot\", \"CCBot\", \"Google-Extended\"], disallow: \"/\" }` to `rules`.",
      "Also check `middleware.ts` and your host's firewall (e.g. Vercel → Firewall) for rules that block these robots by name.",
      CLOUDFLARE,
      PUBLISH.nextjs,
    ],
    react: [
      "Your robot rules file is `public/robots.txt` in your project (it's copied to the main address of the site when you build).",
      DELETE_LINES,
      EVERYONE,
      TRAINING_OK,
      "Also check your host (Netlify, Vercel, Cloudflare Pages) for firewall or bot-blocking settings. " + CLOUDFLARE,
      PUBLISH.react,
    ],
    wordpress: [
      "First go to Settings → Reading and make sure \"Discourage search engines from indexing this site\" is NOT ticked.",
      "Open your robot rules file: Yoast → Yoast SEO → Tools → File editor. Rank Math → Rank Math → General Settings → `Edit robots.txt`.",
      DELETE_LINES + " Click Save.",
      "If those lines aren't there, a plugin adds them: look in Plugins for anything like \"Block AI crawlers\" or \"Dark Visitors\", or a security plugin with an AI-bot blocking setting, and allow the AI search robots.",
      TRAINING_OK,
      CLOUDFLARE,
    ],
    shopify: [
      "Shopify's standard robot rules don't block AI search robots, so someone added a block to your theme.",
      "Go to Online Store → Themes → ⋯ (next to Customize) → Edit code, and open `templates/robots.txt.liquid`.",
      "Delete the lines that add a block for the AI search robots — extra `User-agent:` and `Disallow: /` lines, usually at the bottom. Click Save.",
      "If you don't need any custom rules, delete the whole `robots.txt.liquid` file — Shopify goes back to its safe default.",
      "Also check any bot-protection apps you've installed: some block AI robots. Turn that off for the AI search robots.",
      TRAINING_OK,
    ],
    wix: [
      "In your Wix dashboard go to Marketing & SEO → SEO → Tools and settings → `Robots.txt Editor` → View File.",
      DELETE_LINES + " Click Save Changes.",
      "Not sure? Click Reset to Default — Wix's default rules don't block AI search robots.",
      "Also check SEO Settings: \"Let search engines index your site\" must be on.",
      TRAINING_OK,
    ],
    webflow: [
      "Open Site settings → SEO tab → Indexing.",
      "In the `robots.txt` box, " + DELETE_LINES.charAt(0).toLowerCase() + DELETE_LINES.slice(1),
      EVERYONE,
      "\"Disable Webflow subdomain indexing\" only affects the free webflow.io address — leave it as it is.",
      "Click Save changes, then Publish.",
    ],
    framer: [
      "Framer writes your robot rules file for you and doesn't let you edit it line by line.",
      "Open Site Settings and make sure search engine indexing is on for the site, and that the affected pages aren't set to be hidden from search engines (page settings → Search / SEO).",
      "Framer's own rules don't block AI search robots, so a block usually comes from a service in front of your site. " + CLOUDFLARE,
      "If it's still blocked, contact Framer support with the list of blocked robots from this report.",
      PUBLISH.framer,
    ],
    squarespace: [
      "Squarespace doesn't let you edit the robot rules file, but it has a switch for AI robots.",
      "Go to Settings → Crawlers (in newer dashboards it may be under Settings → Website or Developer tools).",
      "Turn off \"Block known artificial intelligence crawlers\" and click Save. It's one switch for all AI robots, so this lets AI training robots in too — that's your choice.",
      "Also make sure \"Block search engine crawlers\" is off.",
      "If AI robots are still blocked after a day, contact Squarespace support with the list from this report.",
    ],
    custom: [
      "Your robot rules file is a plain text file at `yoursite.com/robots.txt`, in the main folder of your site.",
      `Find the blocks that start with \`User-agent:\` and one of ${SEARCH_BOTS}, followed by \`Disallow: /\`. Delete them.`,
      EVERYONE,
      TRAINING_OK,
      CLOUDFLARE,
      "Upload the changed file.",
    ],
  },
  promptHints: {
    nextjs:
      "Update app/robots.ts (MetadataRoute.Robots) — or public/robots.txt if that's what exists; remove the duplicate — so OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User and Claude-SearchBot are allowed. Keep training crawlers (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended) blocked only if they already are. Also check middleware.ts / next.config headers for user-agent blocking.",
    react: "Edit public/robots.txt so OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User and Claude-SearchBot are not disallowed. Keep existing training-bot blocks. Check hosting config (netlify.toml, vercel.json) for UA blocks.",
    custom: "Edit robots.txt so OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User and Claude-SearchBot are not disallowed; keep training-bot blocks if present. Check server/CDN rules (nginx, .htaccess, Cloudflare) for user-agent blocks.",
  },
  verify: [
    "Open `yoursite.com/robots.txt` in your browser (use your own address). None of the AI search robots (OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot) should have `Disallow: /` under them.",
    "Click \"Check website\" on Home. This problem should disappear from your list.",
    "AI assistants don't re-read sites instantly; it can take days to weeks before answers change, and being readable doesn't guarantee you'll be quoted.",
  ],
  time: "15–30 minutes",
  category: "technical",
};

// ---------------------------------------------------------------------------------------------------------------

const LLMS_OPTIONAL =
  "Remember: the AI guide file is optional. No major AI assistant has confirmed it uses it, so do the other fixes first.";
const LLMS_CONTENT =
  "Write the file as plain text: first line `# <Brand>`, then a line starting with `>` that says in one sentence what you do and where, then a list of your key pages, one per line: `- [Services](https://yoursite.com/services): what's included and prices`.";

export const llmsTxtGuide: FixGuide = {
  effect: () =>
    "Optional: an AI guide file is a short text file that points AI assistants to your most important pages. It's a new idea with no proven effect yet, so it's a low-priority extra.",
  steps: {
    nextjs: [
      LLMS_OPTIONAL,
      LLMS_CONTENT,
      "Save it as `public/llms.txt` in your project — Next.js serves files in `public` at the main address, so it appears at `/llms.txt`.",
      "Want it to update itself? Create `app/llms.txt/route.ts` that returns the text built from your pages, with header `Content-Type: text/plain; charset=utf-8` (and remove the `public` file).",
      PUBLISH.nextjs,
    ],
    react: [LLMS_OPTIONAL, LLMS_CONTENT, "Save it as `public/llms.txt` in your project; it's copied to the main address when you build.", PUBLISH.react],
    wordpress: [
      LLMS_OPTIONAL,
      "Yoast (recent versions): Yoast SEO → Settings → Site features → turn on the AI guide file feature (labelled `llms.txt`). It builds the file for you.",
      "Rank Math (recent versions): Rank Math → Dashboard → Modules → turn on the `LLMS Txt` module, then fill it in under General Settings.",
      "No plugin option? " + LLMS_CONTENT,
      "Then upload the file to your site's main folder (the one with `wp-config.php`) using your host's File Manager or FTP.",
    ],
    shopify: [
      LLMS_OPTIONAL,
      "Shopify doesn't let you put your own file at the main address of your store, so there's no clean way to do this.",
      "Workaround: " + LLMS_CONTENT + " Upload it in Content → Files and copy its link.",
      "Then go to Online Store → Navigation → URL Redirects (or Content → Menus → View URL redirects) → Create URL redirect from `/llms.txt` to that file link.",
      "Or skip it — it's optional and unproven.",
    ],
    wix: [
      LLMS_OPTIONAL,
      "Wix doesn't let you upload your own file to the main address of your site. If your dashboard shows an AI guide file option under Marketing & SEO, use it; otherwise skip this — it's optional and unproven.",
      "Better use of your time: make sure your About, services and contact pages clearly say what you do, where, and for whom.",
      "Site builders are adding this option over time, so look in Marketing & SEO again in a few months.",
    ],
    webflow: [
      LLMS_OPTIONAL,
      LLMS_CONTENT,
      "If your Site settings → SEO tab has an option to upload an AI guide file (labelled `llms.txt`), upload it there and Publish.",
      "If not, Webflow can't host a file at that address; skip it — it's optional and unproven.",
    ],
    framer: [
      LLMS_OPTIONAL,
      "Framer doesn't let you upload a file to the main address of your site.",
      "Workaround: " + LLMS_CONTENT + " Host it somewhere public (e.g. a public file link), then add a redirect in Site Settings → Redirects from `/llms.txt` to that link.",
      "Or skip it — it's optional and unproven.",
    ],
    squarespace: [
      LLMS_OPTIONAL,
      "Squarespace doesn't let you put a file at the main address of your site.",
      "Workaround: " + LLMS_CONTENT + " Upload it as a file (link a word to a file in any text block to upload it), copy its address, then add a redirect in Settings → Developer tools → URL mappings: `/llms.txt -> FILE ADDRESS 302`.",
      "Or skip it — it's optional and unproven.",
    ],
    custom: [
      LLMS_OPTIONAL,
      LLMS_CONTENT,
      "Upload it as `llms.txt` to the main folder of your site, so it opens at `yoursite.com/llms.txt` as plain text.",
      "Update it when you add or remove important pages.",
    ],
  },
  promptHints: {
    nextjs:
      "Create an llms.txt (llmstxt.org format: '# Name', '> one-line summary', then '## Section' headings with '- [Title](absolute URL): description' lines) for the site's key pages. Serve it as public/llms.txt, or as app/llms.txt/route.ts returning text/plain built from the sitemap/routes. Keep it short and factual.",
    react: "Create public/llms.txt in llmstxt.org format ('# Name', '> summary', '- [Title](absolute URL): description') listing the key pages.",
    custom: "Create /llms.txt at the site root in llmstxt.org format ('# Name', '> summary', '- [Title](absolute URL): description') served as text/plain.",
  },
  verify: [
    "Open `yoursite.com/llms.txt` in your browser (use your own address). You should see your plain-text list, not an error page.",
    "Click \"Check website\" on Home. This item should show as done.",
  ],
  time: "20–30 minutes",
  category: "technical",
};

// ---------------------------------------------------------------------------------------------------------------

export const quotableFactsGuide: FixGuide = {
  effect: (ctx) =>
    `AI assistants tend to quote websites that state clear facts. ${ctx.issue.affectedCount} of your pages make claims without numbers, so they give AI nothing specific to quote about ${ctx.brand}.`,
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const n = p.extracted?.statSentenceCount ?? 0;
      const t = lower(topicOf(p, ctx.brand));
      return {
        page: pageName(p.url),
        now: `${n} sentence${n === 1 ? "" : "s"} with a fact or number`,
        change: isHome(p.url)
          ? `Add 2+ facts, e.g. "${ctx.brand} has served [number] customers in [area] since [year]."`
          : `Add 2+ facts, e.g. "A typical ${t} costs from [price] and takes [time]."`,
      };
    }),
  steps: perPlatform((p) => [
    OPEN_PAGE[p],
    "Replace vague claims with facts you can stand behind. Instead of \"fast, affordable service\" write \"We reply within 2 hours, and most jobs cost between [lowest] and [highest price].\"",
    "Good facts: years in business, customers or jobs done, areas covered, response or delivery times, price ranges, guarantees you really offer, ratings (\"4.8 out of 5 from 230 Google reviews\"), certifications and awards.",
    "Write each fact as a full sentence that names <Brand> and makes sense on its own — AI assistants quote sentences, not fragments.",
    "Use exact numbers (\"1,240 homes\") rather than \"thousands\", and say when it was true (\"as of this year\") for numbers that change.",
    "If a number comes from someone else (a study, a government figure), name the source and link to it. Never make numbers up.",
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "On the listed pages, replace vague marketing claims with concrete, self-contained fact sentences (years, counts, prices, times, ratings, areas) that name the business. Use [PLACEHOLDER] for any number not already in the codebase/content — never invent figures. Place key facts near the top in server-rendered text.",
    custom: "Rewrite vague claims on the listed pages as concrete fact sentences naming the business, using [PLACEHOLDER] for unknown numbers. Never invent figures.",
  },
  verify: [
    "Read each page and count the sentences with a real number in them — there should be at least two.",
    "Click \"Check website\" on Home. More pages should count as having facts and numbers.",
  ],
  time: "15 minutes per page",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

export const citedSourcesGuide: FixGuide = {
  effect: (ctx) =>
    `${ctx.issue.affectedCount} of your content pages don't link to any trusted source, so readers, Google and AI assistants have no way to see where your claims come from.`,
  changes: (ctx) =>
    ctx.pages.map((p) => ({
      page: pageName(p.url),
      now: "No links to trusted sources",
      change: `Link 1–2 claims about ${lower(topicOf(p, ctx.brand))} to an official source (government, regulator, standards body, university or major news)`,
    })),
  steps: perPlatform((p) => [
    OPEN_PAGE[p],
    "Find sentences that state a rule, safety point, statistic, grant or average cost — anything a careful reader might ask \"says who?\" about.",
    "Find the original source: a government or regulator site, a standards or industry body, a university or research paper, or a major news outlet — not another company's blog.",
    ADD_LINK[p],
    "Make the linked words name the source (\"according to the national energy agency\"), not \"click here\".",
    "One or two good sources per page is plenty. Never invent a statistic.",
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "For each listed page, identify 1–2 factual claims (regulations, statistics, safety, costs) and suggest authoritative sources (.gov, regulators, standards bodies, universities, major news). Add descriptive <a href> links in the server-rendered copy. Do not fabricate URLs — if unsure, leave a TODO with the search to run.",
    custom: "Add 1–2 descriptive outbound links per listed page to authoritative sources (.gov, regulators, standards bodies, universities, major news) for factual claims. Don't fabricate URLs.",
  },
  verify: [
    "Click each new link — it should open the official source, not an error page.",
    "Click \"Check website\" on Home. More pages should count as linking to trusted sources.",
  ],
  time: "10–15 minutes per page",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

const REVIEW_FIRST = "Review each page in the list and update anything out of date: prices, team, services, opening hours, examples, rules.";
const DATE_LINE = "On normal pages, add a short line near the top or bottom: \"Last updated: [month year]\", and change it whenever you update the page.";
const HONEST_DATE = "Only change the date when you really change the content — a new date on an unchanged page doesn't help.";

export const freshnessGuide: FixGuide = {
  effect: (ctx) =>
    `${ctx.issue.affectedCount} of your pages don't show a recent date, so Google and AI assistants can't tell if the information is current — and for prices, rules and comparisons they often prefer pages that clearly are.`,
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const d = p.extracted?.dateModified ?? p.extracted?.datePublished;
      return {
        page: pageName(p.url),
        now: d ? `Last updated ${d.slice(0, 10)}` : "No date shown",
        change: d ? "Review the content, update what's changed, then update the date" : "Review the content and show \"Last updated: [month year]\"",
      };
    }),
  steps: {
    nextjs: [
      REVIEW_FIRST,
      "Show the date on the page from your content's real update date (e.g. an `updatedAt` field in your CMS or front matter): `<p>Last updated: <time dateTime=\"2026-05-01\">1 May 2026</time></p>`.",
      "Add the same dates to the page's info for Google and AI: `datePublished` and `dateModified` in its `BlogPosting` / `WebPage` data.",
      "Don't set the date to \"today\" on every build — only when the content changes.",
      PUBLISH.nextjs,
    ],
    react: [
      REVIEW_FIRST,
      "Show `Last updated: <time dateTime=\"YYYY-MM-DD\">…</time>` on each page from a real updated date in your content data.",
      "Add `datePublished` / `dateModified` to the page's info for Google and AI, and pre-render the pages so robots see the date.",
      HONEST_DATE,
      PUBLISH.react,
    ],
    wordpress: [
      REVIEW_FIRST + " Click Update — WordPress records the change date.",
      "Show it on posts: block themes → Appearance → Editor → Templates → Single Posts → add a Post Date block and turn on \"Display last modified date\" in its settings. Classic themes: many have a \"show updated date\" option in Appearance → Customize; if not, the free \"WP Last Modified Info\" plugin adds it.",
      "Yoast and Rank Math already pass the updated date to Google and AI — nothing else to set.",
      DATE_LINE,
      HONEST_DATE,
    ],
    shopify: [
      REVIEW_FIRST,
      "Blog posts: Online Store → Themes → Customize → open a blog post template and turn on \"Show date\" in the post section.",
      "Pages: Shopify doesn't show an updated date. " + DATE_LINE,
      HONEST_DATE,
      PUBLISH.shopify,
    ],
    wix: [
      REVIEW_FIRST,
      "Blog posts: in the Editor click your blog's Post page → Settings → Display, and turn on the publish date. Edit and republish posts you've updated.",
      "Pages: " + DATE_LINE,
      HONEST_DATE,
      PUBLISH.wix,
    ],
    webflow: [
      REVIEW_FIRST,
      "CMS pages (blog, guides): on the Collection template, add a text element and connect it to the built-in \"Updated On\" field (or add your own \"Last reviewed\" date field and use that).",
      "Static pages: " + DATE_LINE,
      HONEST_DATE,
      PUBLISH.webflow,
    ],
    framer: [
      REVIEW_FIRST,
      "CMS pages: add a Date field (e.g. \"Last updated\") to the collection, fill it in, and show it on the CMS page with a text layer connected to that field.",
      "Static pages: " + DATE_LINE,
      HONEST_DATE,
      PUBLISH.framer,
    ],
    squarespace: [
      REVIEW_FIRST,
      "Blog posts: most templates show the post date — check the blog page's settings (Item meta / Display) so it's turned on. For updated posts, add \"Updated: [month year]\" at the top of the post.",
      "Pages: " + DATE_LINE,
      HONEST_DATE,
      PUBLISH.squarespace,
    ],
    custom: [
      REVIEW_FIRST,
      "Show `Last updated: <time dateTime=\"YYYY-MM-DD\">…</time>` on each page, taken from the content's real updated date.",
      "Add `datePublished` and `dateModified` to the page's info for Google and AI (or `<meta property=\"article:modified_time\">` on articles).",
      HONEST_DATE,
      PUBLISH.custom,
    ],
  },
  promptHints: {
    nextjs:
      "For the listed pages, render a visible 'Last updated' <time dateTime> from a real content timestamp (CMS updatedAt / front-matter / git mtime at build is NOT acceptable as 'now'). Add datePublished/dateModified to the page's JSON-LD (BlogPosting/WebPage) and, for articles, openGraph.modifiedTime in generateMetadata.",
    react: "Render a visible 'Last updated' <time dateTime> from real content data on each listed route, add dateModified to JSON-LD, and pre-render the routes.",
    custom: "Render a visible 'Last updated' <time dateTime> from real content data on the listed pages and add datePublished/dateModified to their JSON-LD.",
  },
  verify: [
    "Open each page — you should see a \"Last updated\" (or published) date from the last 12 months.",
    "Click \"Check website\" on Home. More pages should count as dated and up to date.",
  ],
  time: "10–20 minutes per page (mostly reviewing the content)",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

const BYLINE = "Under each article's title show \"By [Name], [role] at <Brand>\", linked to a short bio (a team page or author page).";
const BIO = "In the bio, give 2–3 sentences of real experience: years in the trade, qualifications, memberships, and a link to their LinkedIn profile.";

export const authorSignalsGuide: FixGuide = {
  effect: (ctx) =>
    `${ctx.issue.affectedCount === 1 ? "One article doesn't" : `${ctx.issue.affectedCount} articles don't`} say who wrote ${ctx.issue.affectedCount === 1 ? "it" : "them"}. Content from a named person with real experience is more believable to readers, Google and AI assistants.`,
  changes: (ctx) =>
    ctx.pages.map((p) => ({
      page: pageName(p.url),
      now: "No author named",
      change: `Add "By [Name], [role] at ${ctx.brand}" under the title, linked to a short bio`,
    })),
  steps: {
    nextjs: [
      "Add an `author` to each post's data (front matter or CMS): name, role, bio page link.",
      BYLINE,
      "Create a bio page per author (e.g. `app/team/[slug]/page.tsx`). " + BIO,
      "Add `author: { \"@type\": \"Person\", name, url }` to each post's `BlogPosting` info for Google and AI, and `authors: [{ name, url }]` to the post's `metadata`.",
      PUBLISH.nextjs,
    ],
    react: [
      "Add an `author` (name, role, bio link) to each post's data.",
      BYLINE,
      "Create a bio page per author. " + BIO,
      "Add `author: { \"@type\": \"Person\", name, url }` to each post's info for Google and AI, and pre-render the posts so robots see the byline.",
      PUBLISH.react,
    ],
    wordpress: [
      "Go to Users → Profile for each writer: fill in First and Last name, set \"Display name publicly as\" to their real name, and write 2–3 sentences in Biographical Info.",
      BIO,
      "Edit each post in the list → right sidebar → Post → Author: choose the right person → Update.",
      "If your theme hides the author, turn it on: block themes → Appearance → Editor → Templates → Single Posts → add the Post Author block; classic themes → Appearance → Customize → Blog / Single Post settings.",
      "Yoast and Rank Math then add the author to the info for Google and AI automatically.",
    ],
    shopify: [
      "Each blog post's author is a staff account: give writers a staff account with their real name (Settings → Users and permissions).",
      "Go to Online Store → Blog posts → open each post in the list → Author: choose the writer → Save.",
      "Online Store → Themes → Customize → open a blog post template → turn on \"Show author\".",
      "Create a page per author (Online Store → Pages → Add page) with a short bio. " + BIO,
      "At the end of each post, add a line \"About the author\" linking to that page.",
    ],
    wix: [
      "In your dashboard go to Blog → Posts, open each post in the list → Settings → Writer, and choose the right person (writers need to be site members or collaborators with their real name).",
      "In the Editor, click your blog's Post page → Settings → Display, and turn on the writer's name.",
      "Give each writer a profile with a short bio. " + BIO,
      PUBLISH.wix,
    ],
    webflow: [
      "Create an \"Authors\" CMS collection with fields: Name, Role, Photo, Bio, LinkedIn link.",
      "On your Blog Posts collection add a Reference field \"Author\" pointing to Authors, and set it on each post in the list.",
      BYLINE + " On the Blog Post template, add a text element bound to Author → Name and link it to the author's page.",
      BIO,
      PUBLISH.webflow,
    ],
    framer: [
      "In the CMS, create an \"Authors\" collection (Name, Role, Photo, Bio, LinkedIn) and add a Reference field \"Author\" to your blog collection.",
      "Set the author on each post in the list.",
      BYLINE + " On the blog CMS page, add a text layer connected to the author's name, linked to their page.",
      BIO,
      PUBLISH.framer,
    ],
    squarespace: [
      "Each post's author comes from a site contributor — invite writers under Settings → Permissions with their real name.",
      "Open each post in the list → ⋯ → Settings → Options → Author: choose the writer → Save.",
      "Make sure the blog shows the author: open the blog page settings (Item meta / Display) and turn on Author.",
      "Create a short bio page per author. " + BIO,
    ],
    custom: [
      BYLINE,
      "Mark the name up as an author: `<a rel=\"author\" href=\"/team/name\">Name</a>`, and add `<meta name=\"author\" content=\"Name\">`.",
      "Add `author: { \"@type\": \"Person\", name, url }` to each article's info for Google and AI.",
      "Create a bio page per author. " + BIO,
    ],
  },
  promptHints: {
    nextjs:
      "Add author support to the listed articles: an author field in the post data/CMS, a visible byline linking to /team/[slug] bio pages (generateStaticParams), `authors` in generateMetadata, and author Person {name,url} in the BlogPosting JSON-LD. Use placeholders for unknown names.",
    react: "Add visible bylines linked to author bio routes on the listed articles, plus Person author in JSON-LD; ensure pre-rendering.",
    custom: "Add visible bylines (rel=author link to a bio page), <meta name=author>, and Person author in BlogPosting JSON-LD for the listed articles.",
  },
  verify: [
    "Open each article — the writer's name should show under the title and link to their bio.",
    "Click \"Check website\" on Home. More articles should count as having an author.",
  ],
  time: "30 minutes to set up, then 2 minutes per article",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

const PROFILES =
  "List every official profile you have — LinkedIn company page, Facebook, Instagram, YouTube, X, Google Business Profile, Crunchbase, and Wikipedia / Wikidata if you have them. Aim for at least 3; a LinkedIn company page is the easiest strong one to add.";

export const entityClarityGuide: FixGuide = {
  effect: (ctx) =>
    `AI assistants build a picture of ${ctx.brand} from many websites. Without business info that links your site to your official profiles, they have to guess which mentions are you — and may mix you up with someone else.`,
  steps: perPlatform((p) => orgSteps(p, PROFILES)),
  promptHints: ORG_HINTS,
  verify: [
    "Open Google's Rich Results Test (search.google.com/test/rich-results) with your home page: it should show an Organization (or LocalBusiness) with your name, logo and profile links.",
    "Click \"Check website\" on Home. This problem should disappear from your list.",
  ],
  time: "20–40 minutes",
  category: "technical",
};
