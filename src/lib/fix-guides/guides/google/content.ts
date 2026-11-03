// Content guides: enough text per page (incl. JavaScript-only empty pages), copied pages, links between pages, broken links.
import type { FixGuide, FixPage } from "../../types";
import { clip, pageName, topicOf } from "../../helpers";
import { THIN_WORDS } from "@/lib/audit/rules";
import { affected, count, pathKey } from "./shared";

const CHECK_AGAIN = "Click \"Check website\" on Home. This problem should disappear from your list.";

const words = (p: FixPage) => p.extracted?.wordCount ?? null;
const isEmpty = (p: FixPage) => words(p) === 0;

// ---------------------------------------------------------------- Enough content per page (thin / empty pages)

export const thinContentGuide: FixGuide = {
  effect: (ctx) => {
    const empty = ctx.pages.filter(isEmpty).length;
    const short = ctx.pages.filter((p) => (words(p) ?? 0) > 0).length;
    if (empty && short) {
      return `${count(empty, "page")} look${empty === 1 ? "s" : ""} completely empty to Google and AI tools (the words only appear after JavaScript runs), and ${count(short, "more page")} ${short === 1 ? "has" : "have"} fewer than ${THIN_WORDS} words — so there's little for them to understand, show or quote.`;
    }
    if (empty) {
      return `${count(empty, "page")} look${empty === 1 ? "s" : ""} completely empty to Google and AI tools: we found 0 words, because the text only appears after JavaScript runs in a browser. To them, ${empty === 1 ? "this page says" : "these pages say"} nothing about your business.`;
    }
    return `${count(affected(ctx), "page")} ${affected(ctx) === 1 ? "has" : "have"} fewer than ${THIN_WORDS} words, so Google and AI tools have little to understand or quote, and are less likely to show ${affected(ctx) === 1 ? "it" : "them"} for your customers' questions.`;
  },
  changes: (ctx) =>
    [...ctx.pages]
      .sort((a, b) => (words(a) ?? 0) - (words(b) ?? 0))
      .map((p) => {
        const w = words(p);
        const topic = clip(topicOf(p, ctx.brand), 50);
        if (w === 0) {
          return {
            page: pageName(p.url),
            now: "0 words — looks empty without JavaScript",
            change: "Make the text part of the page itself (see the steps), then check it shows in the page source.",
          };
        }
        const add = w === null ? THIN_WORDS : Math.max(50, Math.ceil((THIN_WORDS - w) / 50) * 50);
        return {
          page: pageName(p.url),
          now: w === null ? "Very little text" : `${count(w, "word")}`,
          change: `Add about ${add} words on ${topic}: what it is, who it's for, prices or price range, how it works, why ${ctx.brand}, and 3–5 common questions.`,
        };
      }),
  steps: {
    nextjs: [
      "First, the pages showing 0 words: open each page file (e.g. `app/services/page.tsx`). If it starts with `\"use client\"` and loads its text inside `useEffect` (or with `fetch`, SWR or React Query in the browser), the server sends an empty page and Google sees nothing.",
      "Fix: remove `\"use client\"` from `page.tsx` and make it a server page: `export default async function Page() { const data = await getData(); return <Content data={data} /> }`. Load the text on the server (database, CMS or `fetch`) instead of in `useEffect`.",
      "Keep only the interactive bits (buttons, forms, sliders) in small separate components that start with `\"use client\"`, and pass them the data as props.",
      "For pages made from data (e.g. `app/blog/[slug]/page.tsx`), add `export async function generateStaticParams()` that returns all slugs, so every page is built ahead of time with its text.",
      "Also look for main content wrapped in `dynamic(() => import(…), { ssr: false })` — that removes it from the server page too; drop `ssr: false` for text content.",
      "Deploy, open a page, press Ctrl+U (view source) and search for a sentence from the page. If you find it, Google and AI tools can see it too.",
      "Then the short pages: add real content using the 'Change it to' column — what it is, who it's for, prices, how it works, why choose <Brand>, and common questions with short answers.",
    ],
    react: [
      "Pages showing 0 words are normal for a plain React app: the server sends an empty `index.html` with just `<div id=\"root\"></div>` and the words only appear after JavaScript runs. Many Google and AI robots never see them.",
      "Fix it by pre-rendering: each page is saved as a finished HTML file at build time. With Vite + React Router use `vite-react-ssg`; with Create React App use `react-snap` (add `\"postbuild\": \"react-snap\"` to `package.json`).",
      "Text loaded from an API in `useEffect` won't be in pre-rendered pages — load it at build time (the pre-render tool's data loader) or keep the text in the code/markdown files.",
      "Best long-term fix: move the site to Next.js or Astro, which build every page on the server. This also fixes the same-headline and share-preview problems.",
      "Deploy, open a page, press Ctrl+U (view source) and search for a sentence from the page. If it's there, the fix works.",
      "Then the short pages: add real content using the 'Change it to' column — what it is, who it's for, prices, how it works, why choose <Brand>, and common questions.",
    ],
    wordpress: [
      "Start with the pages at the top of the list. If a page shows 0 words, check whether its words are part of pictures (text baked into a banner image) or inside a slider — Google can't read those. Retype the text as normal text on the page.",
      "Go to Pages → Edit on the first short page.",
      "Add sections with real details using the 'Change it to' column: what it is, who it's for, prices or price range, how it works, why choose <Brand>.",
      "Add a short questions section: use a \"Heading\" block for each question and a paragraph with a 2–3 sentence answer.",
      "If two short pages cover nearly the same thing, merge them into one stronger page and forward the old address to it (Redirection plugin).",
      "Click Update. Aim for at least 300 useful words — quality matters more than length.",
    ],
    shopify: [
      "Start with the pages at the top of the list. If a page shows 0 words, check whether its text is inside images or an app widget that loads later — retype key text as normal text.",
      "Products: Products → open the product → write a fuller \"Description\": what it is, materials/size, who it's for, how to use or care for it, delivery and returns.",
      "Collections: Products → Collections → open the collection → add a \"Description\" of a few paragraphs about the range.",
      "Pages: Online Store → Pages → open the page and add sections with real details and common questions.",
      "Home page: Online Store → Themes → Customize → add a \"Rich text\" or \"Collapsible content\" section describing what you sell and answering common questions.",
      "Save. Aim for at least 300 useful words on your main pages.",
    ],
    wix: [
      "Start with the pages at the top of the list. If a page shows 0 words, check whether its text is inside pictures, or inside an \"Embed HTML\" / iframe box — Google doesn't count those as your page's text. Retype the key text in normal text boxes.",
      "Open the page in the Wix Editor and click \"Add Elements\" (+) → Text, or add a ready-made text section.",
      "Write real details using the 'Change it to' column: what it is, who it's for, prices, how it works, why choose <Brand>.",
      "Add a questions section (Add Elements → \"Interactive\" or a text section) with short answers to common questions.",
      "Click Publish. Aim for at least 300 useful words.",
    ],
    webflow: [
      "Start with the pages at the top of the list. If a page shows 0 words, check whether its text is inside pictures or loaded by a custom code embed — retype the key text as normal text elements.",
      "Open the page in the Designer and add Section → Heading and Paragraph elements with real details from the 'Change it to' column.",
      "For CMS pages, add a Rich text field to the collection, connect it on the template page, and fill it in for each item.",
      "Add a short questions section with a heading per question and a 2–3 sentence answer.",
      "Click Publish. Aim for at least 300 useful words.",
    ],
    framer: [
      "Start with the pages at the top of the list. If a page shows 0 words, check whether its text is inside images or a code embed — retype the key text as normal text layers.",
      "Open the page and add sections with text from the 'Change it to' column: what it is, who it's for, prices, how it works, why choose <Brand>.",
      "For CMS pages, add a Formatted text field to the collection and fill it in for each item.",
      "Add a short questions section with clear answers.",
      "Click Publish. Aim for at least 300 useful words.",
    ],
    squarespace: [
      "Start with the pages at the top of the list. If a page shows 0 words, check whether its text is inside images or a \"Code\" block — retype the key text in Text blocks.",
      "Open the page → Edit → \"Add Section\" or \"Add Block\" → Text.",
      "Write real details using the 'Change it to' column: what it is, who it's for, prices, how it works, why choose <Brand>.",
      "Add an \"Accordion\" block for common questions with short answers.",
      "Click Save. Aim for at least 300 useful words.",
    ],
    custom: [
      "Pages with 0 words: your site most likely builds its pages with JavaScript in the browser, so the HTML the server sends is empty. Ask your developer to switch on server-side rendering or pre-rendering, so the text is in the page itself.",
      "Check it: open the page, press Ctrl+U (view source) and search for a sentence you can see on the page. If it isn't in the source, Google and AI tools likely can't see it.",
      "Short pages: add real content using the 'Change it to' column — what it is, who it's for, prices, how it works, why choose <Brand>, and common questions.",
      "Merge very similar short pages into one stronger page and forward the old addresses to it.",
      "Send the list to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs:
      "Pages with 0 words are rendered client-side: page.tsx (or its main content component) is \"use client\" and fetches content in useEffect / SWR / React Query, or content is wrapped in next/dynamic with { ssr: false }. Convert page.tsx to an async Server Component that fetches data on the server (DB/CMS/fetch with appropriate caching), pass data as props to small client components for interactivity only, and add generateStaticParams for dynamic segments so pages are statically generated. Verify the text is present in the raw HTML (curl the URL). For short pages, add a content section component with the suggested topics and an FAQ section, rendered on the server.",
    react:
      "Client-side SPA: server HTML is an empty #root, so word count is 0 for non-JS crawlers. Add build-time pre-rendering/SSG: vite-react-ssg (Vite + react-router, supports per-route data loaders) or react-snap for CRA (postbuild). Move content fetched in useEffect into build-time loaders or static files so it is present in the generated HTML. Mention migrating to Next.js/Astro as the long-term option. Verify with curl that each route's HTML contains its text.",
    custom: "If pages render content client-side, enable SSR or static pre-rendering so text is present in the initial HTML response. Then extend thin templates/pages with real content sections and an FAQ section for the suggested topics.",
  },
  verify: [
    "Open each page and press Ctrl+U (Cmd+Option+U on Mac) to view the page source. Search for a sentence you can see on the page — it must be in the source, not just on screen.",
    "Count roughly: your main pages should have at least 300 useful words.",
    CHECK_AGAIN,
  ],
  time: "Fixing empty JavaScript pages: half a day or more for a developer. Writing: 30–60 minutes per page",
  category: "content",
};

// ---------------------------------------------------------------- Copied pages (duplicate content)

export const duplicateContentGuide: FixGuide = {
  effect: (ctx) =>
    `${count(affected(ctx), "page")} ${affected(ctx) === 1 ? "has" : "have"} exactly the same text as another page, so Google usually shows only one of the copies — and may pick the wrong one.`,
  changes: (ctx) => {
    const groups = new Map<string, FixPage[]>();
    for (const p of ctx.pages) {
      const k = p.extracted?.contentFingerprint ?? p.url;
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return ctx.pages.map((p) => {
      const group = groups.get(p.extracted?.contentFingerprint ?? p.url) ?? [p];
      const others = group.filter((g) => g !== p).map((g) => pageName(g.url));
      const main = [...group].sort((a, b) => pathKey(a.url).length - pathKey(b.url).length)[0];
      const isMain = main === p;
      return {
        page: pageName(p.url),
        now: others.length ? `Same text as ${others.slice(0, 2).join(", ")}${others.length > 2 ? ", …" : ""}` : "Same text as another page",
        change: isMain || !others.length
          ? "Keep this one as the main version (or rewrite the others with their own details)."
          : `Forward this address to ${pageName(main.url)} — or, if it should be a different page, rewrite it with its own details.`,
      };
    });
  },
  steps: {
    nextjs: [
      "Look at the pairs in the 'Change it to' list. Common causes: the same component rendered under two routes, old and new addresses both live, or pages made from one template with only the name changed.",
      "If a copy shouldn't exist, forward it: in `next.config.js` (or `next.config.ts`) add to `async redirects()` an entry `{ source: \"/old-page\", destination: \"/main-page\", permanent: true }`, and delete the old route folder.",
      "If both pages must stay (e.g. a print version), give the copy `alternates: { canonical: \"/main-page\" }` in its `metadata` so Google knows which is the main one.",
      "If the pages should be different (e.g. one per town or service), rewrite each with its own details: local facts, prices, photos, reviews and questions.",
      "Deploy and open the old address — it should jump straight to the main page.",
    ],
    react: [
      "Look at the pairs in the 'Change it to' list. Often two routes in your router show the same component.",
      "Remove the extra route, or forward it: on Vercel add a `redirects` entry in `vercel.json`; on Netlify add a line `/old-page /main-page 301` to `public/_redirects`.",
      "If both must stay, add `<link rel=\"canonical\" href=\"…/main-page\">` on the copy (with pre-rendering so it's in the HTML).",
      "If the pages should be different, rewrite each with its own details.",
      "Deploy and open the old address — it should go straight to the main page.",
    ],
    wordpress: [
      "Look at the pairs in the 'Change it to' list and decide which page is the main version.",
      "If the copy isn't needed: install the \"Redirection\" plugin → Tools → Redirection → Add new: \"Source URL\" = the copy's address, \"Target URL\" = the main page → Add Redirect. Then move the copy to the Trash.",
      "If both must stay, open the copy → Yoast box → \"Advanced\" → \"Canonical URL\" (Rank Math: \"Advanced\" tab) → paste the main page's address → Update.",
      "Tag, category and archive pages often repeat the same text. In Yoast → Settings → Categories & tags, switch \"Show … in search results\" off for ones you don't need.",
      "If the pages should be different (e.g. two locations), rewrite each with its own details.",
    ],
    shopify: [
      "Shopify already points product copies (e.g. a product inside a collection address) to the main product page — you don't need to fix those.",
      "For other copies, decide which page is the main version from the 'Change it to' list.",
      "If the copy isn't needed: Online Store → Navigation → \"URL Redirects\" → Create URL redirect: from the copy's address to the main page → Save. Then delete or hide the copy.",
      "Products that are near-identical (e.g. same text for each colour) are better as one product with variants, or rewrite each description with its own details.",
      "Save and open the old address to check it forwards.",
    ],
    wix: [
      "Look at the pairs in the 'Change it to' list and decide which page is the main version.",
      "If the copy isn't needed: Dashboard → \"Marketing & SEO\" → \"SEO Tools\" → \"URL Redirect Manager\" → New Redirect: old address → main page. Then delete the copy (Pages & Menu → ⋯ → Delete).",
      "If both must stay, open the copy's \"SEO basics\" → \"Advanced SEO\" and set the main version address to the main page.",
      "If the pages should be different (e.g. two locations), rewrite each with its own details.",
      "Click Publish.",
    ],
    webflow: [
      "Look at the pairs in the 'Change it to' list and decide which page is the main version.",
      "If the copy isn't needed: Site settings → \"Publishing\" (older: \"Hosting\") → \"301 redirects\" → add the copy's path as old path and the main page as redirect to. Then delete the copy.",
      "If both must stay, open the copy's Page settings → \"Custom code\" → \"Inside <head> tag\" and add `<link rel=\"canonical\" href=\"https://www.yourdomain.com/main-page\">`.",
      "CMS items made from the same template: give each item its own text in the collection.",
      "Click Publish.",
    ],
    framer: [
      "Look at the pairs in the 'Change it to' list and decide which page is the main version.",
      "If the copy isn't needed: Site settings → \"Redirects\" → add from the copy's path to the main page. Then delete the copy page.",
      "If the pages should be different, rewrite each with its own details.",
      "Click Publish.",
    ],
    squarespace: [
      "Look at the pairs in the 'Change it to' list and decide which page is the main version.",
      "If the copy isn't needed: Settings → Developer Tools → \"URL Mappings\" → add a line like `/old-page -> /main-page 301` → Save. Then delete or disable the copy.",
      "If the pages should be different (e.g. two locations), rewrite each with its own details.",
      "Click Save.",
    ],
    custom: [
      "Decide which page in each pair is the main version.",
      "Forward copies you don't need with a permanent (301) redirect to the main page.",
      "If both must stay, add `<link rel=\"canonical\" href=\"…\">` on the copy pointing at the main page.",
      "If the pages should be different, rewrite each with its own details.",
      "Send the list to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs:
      "Resolve duplicate routes: remove redundant routes and add permanent redirects in next.config `redirects()`; for intentional duplicates set `alternates.canonical` to the primary path. Check for routes rendering the same component, trailing-slash/case variants, and query-param variants. For templated pages (locations/services), make the content data-driven with unique fields.",
    react: "Remove duplicate routes; add host-level 301s (vercel.json redirects / Netlify _redirects); add per-route canonical in pre-rendered HTML for intentional duplicates.",
    custom: "Add 301 redirects from duplicate URLs to the primary URL; for intentional duplicates add a canonical link to the primary; normalise host, trailing slash and query params.",
  },
  verify: [
    "Open each forwarded address — it should go straight to the main page.",
    "For copies you kept, view the source (Ctrl+U) and check rel=\"canonical\" points at the main page.",
    CHECK_AGAIN,
  ],
  time: "30–60 minutes (longer if pages need rewriting)",
  category: "content",
};

// ---------------------------------------------------------------- Links between your pages (orphan pages)

export const internalLinksGuide: FixGuide = {
  effect: (ctx) =>
    `${count(affected(ctx), "page")} ${affected(ctx) === 1 ? "isn't" : "aren't"} linked from any other page, so visitors can't find ${affected(ctx) === 1 ? "it" : "them"} and Google treats ${affected(ctx) === 1 ? "it" : "them"} as unimportant.`,
  changes: (ctx) =>
    ctx.pages.map((p) => ({
      page: pageName(p.url),
      now: "No other page links here",
      change: `Add a link with the words “${clip(topicOf(p, ctx.brand), 50)}” from your menu, footer or a related page.`,
    })),
  steps: {
    nextjs: [
      "Decide where each page in the list belongs: the main menu, the footer, or inside a related page's text (e.g. a service page linking to its prices page).",
      "Add the link with `<Link href=\"/page-address\">Clear words</Link>` from `next/link` — usually in your header/footer component (e.g. `components/Header.tsx`, `components/Footer.tsx`) or the related page.",
      "Don't use buttons or `onClick={() => router.push(…)}` for navigation — Google only follows real links (`<a href>`), which `<Link>` creates.",
      "Use clear link words like \"See our prices\", not \"Click here\".",
      "If a page isn't needed any more, delete it (and forward its address) instead of linking to it.",
      "Deploy and click through your menu to check the new links.",
    ],
    react: [
      "Decide where each page belongs: menu, footer, or a related page's text.",
      "Add links with React Router's `<Link to=\"/page-address\">Clear words</Link>` (it creates a real link).",
      "Don't navigate with `onClick` + `navigate()` on buttons or divs — Google can't follow those.",
      "Pre-render your pages (`vite-react-ssg` / `react-snap`) so the links are in the HTML Google reads.",
      "Deploy and click through to check.",
    ],
    wordpress: [
      "To add a page to your menu: Appearance → Menus (block themes: Appearance → Editor → Navigation) → add the page → Save.",
      "To link from a related page: Pages → Edit the related page → highlight a few words → click the link icon (or Ctrl+K) → search for the page → Enter → Update.",
      "Use clear link words like \"See our prices\", not \"Click here\".",
      "Footer links: Appearance → Widgets (or Editor → Patterns → Footer) → add a links list.",
      "If a page isn't needed any more, move it to the Trash and forward its address with the Redirection plugin.",
    ],
    shopify: [
      "To add a page to your menu: Online Store → Navigation → open \"Main menu\" (or \"Footer menu\") → Add menu item → pick the page → Save.",
      "To link from a related page or product: open it → highlight words in the description → click the link icon → choose the page → Save.",
      "Products not in any collection are hard to find — add them to a collection (Products → open the product → \"Collections\").",
      "Use clear link words like \"See our delivery times\", not \"Click here\".",
    ],
    wix: [
      "To add a page to your menu: in the Editor click Pages & Menu → check the page isn't hidden from the menu (⋯ → \"Show in Menu\").",
      "To link from a related page: select text or a button → click the link icon → \"Page\" → choose the page → Done.",
      "Use clear link words like \"See our prices\", not \"Click here\".",
      "Click Publish.",
    ],
    webflow: [
      "To add a page to your menu: open your Navbar → add a Nav Link → in the Settings panel set \"Link\" to the page.",
      "To link from a related page: select text → click the link icon → choose \"Page\" → the page.",
      "For CMS items, add a Collection List of related items on the template page so every item gets linked.",
      "Use clear link words, then click Publish.",
    ],
    framer: [
      "To add a page to your menu: select your navigation component → add a link → choose the page.",
      "To link from a related page: select text → click the link icon in the text toolbar → choose the page.",
      "For CMS items, add a Collection List of related items to the CMS page.",
      "Use clear link words, then click Publish.",
    ],
    squarespace: [
      "To add a page to your menu: Pages → drag the page from \"Not Linked\" into \"Main Navigation\" (or \"Footer Navigation\").",
      "To link from a related page: Edit the related page → highlight text → click the link icon → choose the page → Save.",
      "Use clear link words like \"See our prices\", not \"Click here\".",
      "Click Save.",
    ],
    custom: [
      "Add a normal link (`<a href=\"/page-address\">Clear words</a>`) to each page in the list from your menu, footer or a related page.",
      "Don't use JavaScript-only clicks for navigation — Google only follows real links.",
      "Use clear link words like \"See our prices\", not \"Click here\".",
      "Send the list to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs: "Add crawlable <Link href> links (rendered as <a href>) to each orphan page from the header/footer navigation or contextually related pages. Replace any router.push/onClick-only navigation with <Link>. Ensure links are in server-rendered HTML.",
    react: "Add react-router <Link to> (renders <a href>) links to each orphan route from nav/footer/related pages; replace onClick navigate() navigation; pre-render so links exist in HTML.",
    custom: "Add <a href> links to each orphan page from navigation, footer or related pages in the server-rendered HTML; avoid JS-only navigation.",
  },
  verify: [
    "Open your home page and try to reach each page in the list by clicking — you should get there in 2–3 clicks.",
    CHECK_AGAIN,
  ],
  time: "15–30 minutes",
  category: "onsite",
};

// ---------------------------------------------------------------- Broken links between your pages

/** Broken addresses from the issue evidence: "Broken: https://a/x, https://a/y". */
function brokenTargets(evidence: string | undefined): string[] {
  const m = evidence?.match(/^Broken:\s*(.+)$/);
  return m ? m[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean) : [];
}

export const brokenLinksGuide: FixGuide = {
  effect: (ctx) =>
    `${count(affected(ctx), "page")} on your site ${affected(ctx) === 1 ? "has" : "have"} links that end on an error page, which annoys visitors and wastes the time Google spends on your site.`,
  changes: (ctx) => {
    const broken = brokenTargets(ctx.issue.evidence);
    const brokenKeys = new Set(broken.map(pathKey));
    return ctx.pages.map((p) => {
      const found = (p.extracted?.internalLinks ?? []).filter((l) => brokenKeys.has(pathKey(l)));
      const list = Array.from(new Set(found.map((l) => pageName(l))));
      return {
        page: pageName(p.url),
        now: list.length ? `Links to ${list.slice(0, 3).join(", ")}${list.length > 3 ? ", …" : ""} (error page)` : "Has a link to a page that doesn't work",
        change: "Point the link at the right page, remove it, or forward the old address to the new page.",
      };
    });
  },
  steps: {
    nextjs: [
      "Use the list above: each row shows a page and the broken address it links to.",
      "Search your code for the broken address (e.g. `/old-services`) — it's usually in a menu, footer or page component, or in content from your CMS.",
      "Change the `href` to the right page, or remove the link.",
      "If the page moved, also forward the old address: in `next.config.js` add `{ source: \"/old-services\", destination: \"/services\", permanent: true }` to `async redirects()`.",
      "For pages made from data (blog posts, products), check `generateStaticParams` and the data — a deleted item can leave links behind.",
      "Deploy and click each fixed link.",
    ],
    react: [
      "Use the list above to find each page and broken address.",
      "Search your code for the broken address and fix the `<Link to>` / `href`, or remove it.",
      "If the page moved, forward the old address on your host (`vercel.json` redirects, or a line in Netlify's `public/_redirects`).",
      "Check your router: an address may be missing from the routes list after a rename.",
      "Deploy and click each fixed link.",
    ],
    wordpress: [
      "Install the \"Broken Link Checker\" plugin (Plugins → Add New) — it lists every broken link and lets you edit or remove it in one place. Or work from the list above.",
      "For links in page text: Pages → Edit the page → click the link → pencil icon → choose the right page → Update.",
      "For menu links: Appearance → Menus (or Editor → Navigation) → fix or remove the item → Save.",
      "If a page moved, forward the old address: \"Redirection\" plugin → Tools → Redirection → Add new.",
      "If a page was deleted by mistake, restore it from Pages → Trash.",
    ],
    shopify: [
      "Use the list above to find each page and broken address.",
      "Menu links: Online Store → Navigation → open the menu → fix or remove the item → Save.",
      "Links in text: open the page, product or blog post → click the link → edit it → Save.",
      "If a product or page was deleted or renamed, forward the old address: Online Store → Navigation → \"URL Redirects\" → Create URL redirect. (Shopify offers to do this automatically when you change a page's address — keep that box ticked.)",
    ],
    wix: [
      "Use the list above to find each page and broken address.",
      "In the Editor, click the button, text or menu item with the broken link → link icon → choose the right page → Done.",
      "If a page moved, forward the old address: Dashboard → \"Marketing & SEO\" → \"SEO Tools\" → \"URL Redirect Manager\" → New Redirect.",
      "Click Publish.",
    ],
    webflow: [
      "Use the list above to find each page and broken address.",
      "In the Designer, select the link or button → Settings panel → fix the \"Link\" setting, or remove it.",
      "Check Navbar and Footer symbols — a fix there updates every page.",
      "If a page moved, add a forward: Site settings → \"Publishing\" (older: \"Hosting\") → \"301 redirects\".",
      "Click Publish.",
    ],
    framer: [
      "Use the list above to find each page and broken address.",
      "Select the link, button or menu item → fix the link in the right-hand panel, or remove it.",
      "If a page moved, add a forward: Site settings → \"Redirects\".",
      "Click Publish.",
    ],
    squarespace: [
      "Use the list above to find each page and broken address.",
      "Edit the page → click the link or button → fix the link (choose the page from the list) → Save.",
      "Menu links: Pages → check the item under \"Main Navigation\".",
      "If a page moved, forward the old address: Settings → Developer Tools → \"URL Mappings\" → add `/old-page -> /new-page 301`.",
    ],
    custom: [
      "Use the list above: each row shows the page and the broken address it links to.",
      "Fix each link to point to the right page, or remove it.",
      "If a page moved, add a permanent (301) redirect from the old address to the new one.",
      "Send the list to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs: "Find hrefs to the broken URLs (components, nav/footer config, MDX/CMS content), fix or remove them, and add permanent redirects in next.config redirects() for moved pages. Check dynamic routes for removed items still linked.",
    react: "Find <Link to>/href references to the broken URLs and fix them; check the router config for missing routes; add host-level 301 redirects for moved pages.",
    custom: "Fix or remove links to the broken internal URLs in templates/content; add 301 redirects for moved pages.",
  },
  verify: [
    "Click each fixed link — it should open a working page.",
    CHECK_AGAIN,
  ],
  time: "15–45 minutes",
  category: "technical",
};
