// On-page guides: Google summaries, main headings, main version of the page, image descriptions, share previews.
import type { FixGuide } from "../../types";
import { clip, isHome, pageName, suggestTitle, topicOf } from "../../helpers";
import { DESCRIPTION_MAX } from "@/lib/audit/rules";
import { affected, count, fileName, imagesWithoutDescription, ownAddress } from "./shared";

const CHECK_AGAIN = "Click \"Check website\" on Home. This problem should disappear from your list.";

// ---------------------------------------------------------------- Google summaries (meta description)

export const metaDescriptionGuide: FixGuide = {
  effect: (ctx) =>
    `${count(affected(ctx), "page")} ${affected(ctx) === 1 ? "has" : "have"} no clear Google summary of its own, so Google picks a random bit of text to show under your link — and fewer people click.`,
  changes: (ctx) => {
    const seen = new Map<string, number>();
    for (const p of ctx.pages) {
      const d = p.extracted?.description?.trim().toLowerCase();
      if (d) seen.set(d, (seen.get(d) ?? 0) + 1);
    }
    return ctx.pages.map((p) => {
      const d = p.extracted?.description?.trim();
      const now = !d
        ? "(no Google summary)"
        : d.length > DESCRIPTION_MAX
          ? `Too long (${d.length} characters): “${clip(d, 70)}”`
          : (seen.get(d.toLowerCase()) ?? 0) > 1
            ? `Same as another page: “${clip(d, 70)}”`
            : `“${clip(d, 70)}”`;
      const change = isHome(p.url)
        ? `Write 1–2 sentences (120–155 characters): what ${ctx.brand} does, for whom and where, plus one reason to choose you.`
        : `Write 1–2 sentences (120–155 characters) about ${topicOf(p, ctx.brand)}: what you offer, who it's for, and one reason to choose ${ctx.brand}.`;
      return { page: pageName(p.url), now, change };
    });
  },
  steps: {
    nextjs: [
      "Open your project's code (or ask your developer). In the `app` folder each page has its own folder, e.g. `app/services/page.tsx` is the /services page.",
      "Check `app/layout.tsx`: if it sets a `description`, every page without its own inherits that same text — that's why many pages share one summary. Keep it only as a fallback for the home page.",
      "In each page file add `export const metadata = { description: \"…\" }` with the text from the 'Change it to' column (120–155 characters).",
      "For pages made from data (blog posts, products, e.g. `app/blog/[slug]/page.tsx`), use `export async function generateMetadata({ params })` and return `{ description: post.summary }` — a short summary written for each item.",
      "If a page file starts with `\"use client\"`, it can't export metadata. Move the client code into a separate component and make `page.tsx` a normal (server) file that exports `metadata`.",
      "Using the older `pages` folder? Add `<Head><meta name=\"description\" content=\"…\" /></Head>` from `next/head` in each page.",
      "Deploy, open each page and press Ctrl+U (view source). Search for `name=\"description\"` — your new text should be there.",
    ],
    react: [
      "Your site is a single-page React app: every address loads the same `index.html`, so Google sees the same summary (or none) on every page.",
      "Quick improvement: with `react-helmet-async` (or a `<meta name=\"description\">` tag inside each page component on React 19), give every page the text from the 'Change it to' column.",
      "Real fix: pre-render your pages so each address is saved as its own HTML file with its own summary — `vite-react-ssg` for Vite, `react-snap` for Create React App.",
      "Best long-term fix: move to a framework that builds every page on the server, like Next.js or Astro.",
      "After deploying, open each page, press Ctrl+U and search for `name=\"description\"`. If every page shows the same text, pre-rendering isn't working yet.",
    ],
    wordpress: [
      "Log in to WordPress (yoursite.com/wp-admin).",
      "If you don't have the plugin yet: Plugins → Add New, search \"Yoast SEO\" (or \"Rank Math SEO\"), click Install, then Activate.",
      "Go to Pages (or Posts) and click Edit on the first page from the list above.",
      "Yoast: scroll below the editor to the Yoast box and fill in \"Meta description\". Rank Math: click the Rank Math icon at the top right → \"Edit Snippet\" → \"Description\".",
      "Type the 1–2 sentences from the 'Change it to' column. Watch the bar under the box — it turns green at a good length. Click Update.",
      "Repeat for every page in the list, starting with the home page and your service pages.",
      "Products in WooCommerce have the same box under the product editor.",
    ],
    shopify: [
      "Open your Shopify admin.",
      "For the home page: Online Store → Preferences → \"Homepage meta description\". Type the new text and click Save.",
      "For other pages: Online Store → Pages (or Products, Collections, Blog posts) → open the page.",
      "Scroll to \"Search engine listing\" at the bottom → click Edit → fill in \"Meta description\" with the text from the 'Change it to' column → Save.",
      "If you leave it empty, Shopify uses the first lines of the page or product text, which often reads badly — so fill it in for your main products and collections too.",
      "Repeat for every page in the list.",
    ],
    wix: [
      "Open your site in the Wix Editor.",
      "Click Pages & Menu on the left, hover the first page in the list, click the ⋯ (more) icon → \"SEO basics\".",
      "Fill in \"Meta description\" with the text from the 'Change it to' column.",
      "Repeat for every page, then click Publish at the top right.",
      "For blog posts and products: open them from your dashboard (Blog or Store Products) → the \"SEO\" tab or section → fill in the description there.",
    ],
    webflow: [
      "Open your project in the Webflow Designer.",
      "Open the Pages panel (left side), hover the page and click the gear icon (Page settings).",
      "Under \"SEO settings\", fill in \"Meta description\" with the text from the 'Change it to' column. Click Save.",
      "For CMS pages (blog posts, collections): open the Collection template's settings and connect the description to a field, e.g. a \"Summary\" field you fill in for each item.",
      "Click Publish.",
    ],
    framer: [
      "Open your project in Framer.",
      "In the Pages panel on the left, hover the page and click the ⋯ / settings icon (Page settings).",
      "Under \"SEO\", fill in \"Description\" with the text from the 'Change it to' column.",
      "For CMS pages, open the CMS page settings and set the Description to a summary field from the collection.",
      "Click Publish at the top right.",
    ],
    squarespace: [
      "Open your site in Squarespace and go to Pages.",
      "Hover the page, click the gear icon → \"SEO\" tab.",
      "Fill in \"SEO description\" with the text from the 'Change it to' column. Click Save.",
      "For the home page summary: Marketing → \"SEO\" → \"Search appearance\" (or the home page's own settings) → fill in the site description.",
      "For blog posts and products: open the item → gear or ⋯ → \"SEO\" tab → fill in the description.",
      "Repeat for every page in the list.",
    ],
    custom: [
      "Every page's HTML has (or should have) a `<meta name=\"description\" content=\"…\">` tag inside `<head>`. That text is the summary Google shows under your link.",
      "Give each page its own 1–2 sentences (120–155 characters) from the 'Change it to' column.",
      "Make sure a shared template doesn't print the same summary on every page.",
      "If your site builds pages with JavaScript, the summary must already be in the HTML the server sends (server-side rendering or pre-rendering).",
      "Send the 'Change it to' list to your web developer, or paste the AI prompt below into an AI coding assistant inside your project.",
    ],
  },
  promptHints: {
    nextjs:
      "Next.js Metadata API: set `description` per route via `export const metadata` in app/**/page.tsx, and `generateMetadata` for dynamic routes. A `description` in app/layout.tsx is inherited by every page that doesn't override it — that causes duplicates; keep it only as a home/fallback value. \"use client\" pages can't export metadata: split into a server page.tsx + client component. pages/ router: next/head. Keep each description 120–155 characters and unique.",
    react:
      "Client-side React SPA: crawlers only see index.html. Add per-route `<meta name=\"description\">` (react-helmet-async, or React 19 hoisted <meta> in components) AND pre-render routes (vite-react-ssg / vite-plugin-prerender for Vite, react-snap for CRA) so each route's HTML contains its own description.",
    custom: "Find where each page's <head> is produced (templates/layouts/components) and render a unique `<meta name=\"description\">` (120–155 characters) per page in the server-sent HTML. Remove any site-wide hard-coded description from the shared template.",
  },
  verify: [
    "Open each page, press Ctrl+U (Cmd+Option+U on Mac) to view the page source and search for name=\"description\". Your new text must be there.",
    CHECK_AGAIN,
    "Google may still choose other text from the page for some searches — that's normal. It updates its results in a few days to a few weeks.",
  ],
  time: "5–10 minutes per page (about 30–60 minutes in total)",
  category: "onsite",
};

// ---------------------------------------------------------------- Main headings (H1)

export const h1Guide: FixGuide = {
  effect: (ctx) =>
    `${count(affected(ctx), "page")} ${affected(ctx) === 1 ? "has" : "have"} no single, clear main heading, so visitors, Google and AI tools have to guess what the page is mainly about.`,
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const h = p.extracted?.h1.map((t) => t.trim()).filter(Boolean) ?? [];
      const topic = isHome(p.url) ? suggestTitle(p, ctx.brand).replace(/ \| .*$/, "") : topicOf(p, ctx.brand);
      if (h.length > 1) {
        const keep = h.find((t) => t.toLowerCase() !== ctx.brand.toLowerCase()) ?? h[0];
        return {
          page: pageName(p.url),
          now: `${h.length} main headings: ${h.slice(0, 3).map((t) => `“${clip(t, 40)}”`).join(", ")}`,
          change: `Keep only “${clip(keep, 60)}” as the main heading; make the others Heading 2.`,
        };
      }
      return {
        page: pageName(p.url),
        now: h.length ? `“${clip(h[0], 60)}”` : "(no main heading)",
        change: `Add one main heading at the top, e.g. “${clip(topic, 60)}”.`,
      };
    }),
  steps: {
    nextjs: [
      "Open the page file in the `app` folder, e.g. `app/services/page.tsx` for /services.",
      "Make sure the page shows exactly one `<h1>` at the top with the text from the 'Change it to' column. Every other section title should be `<h2>` (or `<h3>` below that).",
      "Check shared parts too: if `app/layout.tsx` or your header component wraps the logo or site name in `<h1>`, change it to a `<div>` or `<p>` — otherwise every page gets an extra main heading.",
      "If your heading comes from a design component (e.g. `<Heading>` or `<Title>`), check which tag it outputs and pass the level it needs (e.g. `as=\"h1\"`).",
      "If the page shows 0 words or no heading at all in the page source, it's built only in the browser — see the 'Enough content per page' fix too.",
      "Deploy, open the page, press Ctrl+U and search for `<h1` — there should be exactly one.",
    ],
    react: [
      "Open the component for each page in the list (usually in `src/pages` or `src/routes`).",
      "Give each page exactly one `<h1>` with the text from the 'Change it to' column; turn the other big titles into `<h2>`/`<h3>`.",
      "Check your header/layout component: the logo or site name should not be an `<h1>`.",
      "Remember Google may only see `index.html` on a plain React app — pre-render your pages (`vite-react-ssg` or `react-snap`) so the heading is in the HTML Google receives.",
      "After deploying, press Ctrl+U on each page and search for `<h1` — there should be exactly one.",
    ],
    wordpress: [
      "Log in to WordPress and open the page from the list (Pages → Edit).",
      "In most themes the page title at the top of the editor is the main heading. Make it clear and specific, e.g. the text from the 'Change it to' column.",
      "In the page content, click each big heading block and check its level in the toolbar (H1, H2…). Change any extra \"H1\" to \"H2\".",
      "Using Elementor or another page builder? Click the heading → in its settings, set \"HTML Tag\" to H2 for all but one heading.",
      "If your theme hides the page title (or prints the logo as a main heading), switch the title back on in the page's theme settings, or ask your developer to fix the theme.",
      "Click Update and check the page.",
    ],
    shopify: [
      "On Shopify the theme decides which text becomes the main heading: on product, collection and normal pages it's the title you type in the admin, so make that title clear.",
      "Inside page and product text, the editor's text style menu (the \"Paragraph\" drop-down) should not use \"Heading 1\" — change those to \"Heading 2\".",
      "The home page often has no main heading at all. Online Store → Themes → Customize: put a short line saying what you do (e.g. the text from the 'Change it to' column) in the first banner or text section.",
      "If that line still isn't a main heading, your theme marks it as a smaller heading. Ask your theme developer (or a Shopify expert) to change that section's first heading tag to H1 in the theme code (Online Store → Themes → ⋯ → Edit code → the section file, e.g. `sections/image-banner.liquid`).",
      "Save and preview the page.",
    ],
    wix: [
      "Open your site in the Wix Editor and go to the page from the list.",
      "Click the big headline at the top of the page → \"Edit Text\".",
      "In the text panel, choose \"Heading 1\" from the text theme list for this headline only.",
      "For other big titles on the same page, choose \"Heading 2\" or \"Heading 3\". (Under \"SEO & accessibility\" in the text settings you can also check which heading tag a text box uses.)",
      "Repeat for every page in the list, then click Publish.",
    ],
    webflow: [
      "Open the page in the Webflow Designer.",
      "Select the main headline at the top and open the Settings panel (gear icon on the right, or press D).",
      "Set the heading level to \"H1\". Only this heading should be H1.",
      "Select any other heading that is set to H1 and change it to H2 (or H3). Check your Navbar and Footer symbols too — the logo should not be H1.",
      "For CMS template pages, connect the H1 to the item's name field so every item gets its own main heading.",
      "Click Publish.",
    ],
    framer: [
      "Open the page in Framer.",
      "Select the main headline text layer at the top.",
      "In the right-hand panel under Text, set the \"Tag\" to \"Heading 1\".",
      "Select any other text set to \"Heading 1\" and change it to \"Heading 2\" (or \"Paragraph\" for normal text). Check reusable components like your navigation too.",
      "Click Publish.",
    ],
    squarespace: [
      "Open the page in Squarespace and click Edit.",
      "Click into the main headline text block and highlight the text.",
      "From the text style drop-down in the toolbar choose \"Heading 1\".",
      "Highlight any other text set to \"Heading 1\" and change it to \"Heading 2\" or \"Heading 3\".",
      "Click Save, then repeat for every page in the list.",
    ],
    custom: [
      "Each page should have exactly one `<h1>` tag: the main headline, saying what the page is about.",
      "Use the text from the 'Change it to' column. Turn all other big titles into `<h2>`/`<h3>`.",
      "Check the shared header template — the logo or site name shouldn't be an `<h1>`.",
      "Make sure the heading is in the HTML the server sends, not only added later by JavaScript.",
      "Send the list to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs:
      "Each route must render exactly one <h1> in the server HTML. Check app/layout.tsx and shared Header/Logo components for an <h1> that repeats on every page (change to div/p). Check design-system Heading components for their rendered tag. Use the suggested heading text per page.",
    react:
      "Each route component should render exactly one <h1>; remove <h1> from shared layout/header. Because this is a client-side SPA, also set up pre-rendering (vite-react-ssg / react-snap) so headings exist in the served HTML.",
    custom: "Ensure exactly one <h1> per page in the server-rendered HTML; demote other headings to h2/h3 and remove any site-wide <h1> in shared templates.",
  },
  verify: [
    "Open each page and check there's one big headline at the top that says what the page is about.",
    "Press Ctrl+U (Cmd+Option+U on Mac) to view the page source and search for <h1 — it should appear exactly once.",
    CHECK_AGAIN,
  ],
  time: "5–10 minutes per page",
  category: "onsite",
};

// ---------------------------------------------------------------- Main version of the page (canonical)

export const canonicalGuide: FixGuide = {
  effect: (ctx) => {
    const offsite = ctx.pages.filter((p) => p.extracted?.canonical).length;
    return offsite
      ? `${count(offsite, "page")} tell${offsite === 1 ? "s" : ""} Google that another website holds the main version, so that site may get the credit and your page may be left out of Google.`
      : `${count(affected(ctx), "page")} ${affected(ctx) === 1 ? "doesn't" : "don't"} say which address is the main one, so Google may split credit between copies (with and without "www", with extra bits after "?") or pick the wrong one.`;
  },
  changes: (ctx) =>
    ctx.pages.map((p) => ({
      page: pageName(p.url),
      now: p.extracted?.canonical ? `Points to ${clip(p.extracted.canonical, 70)}` : "(not set)",
      change: `Point to the page's own address: ${clip(ownAddress(p.url), 80)}`,
    })),
  steps: {
    nextjs: [
      "Open `app/layout.tsx` and set your real website address once: `export const metadata = { metadataBase: new URL(\"https://www.yourdomain.com\") }`.",
      "Don't put `alternates.canonical` in `app/layout.tsx` — every page would inherit it and point Google at the home page.",
      "In each page file add `alternates: { canonical: \"/services\" }` to its `metadata` (use the page's own path; Next.js adds your domain from `metadataBase`).",
      "For pages made from data (e.g. `app/blog/[slug]/page.tsx`), return `alternates: { canonical: \"/blog/\" + slug }` from `generateMetadata`.",
      "If a page points to another website, search the code for `canonical` and fix the wrong address (often copied from a template or an old domain).",
      "Deploy, open each page, press Ctrl+U and search for `rel=\"canonical\"` — it should show that page's own address.",
    ],
    react: [
      "On a plain React app every address serves the same `index.html`, so a main-version tag there is the same for every page — check `index.html` and remove any hard-coded `<link rel=\"canonical\">` that points to one address.",
      "Add a `<link rel=\"canonical\" href=\"…\">` per page with `react-helmet-async` (or inside each page component on React 19), using the page's own address from the 'Change it to' column.",
      "Pre-render your pages (`vite-react-ssg` or `react-snap`) so the tag is in the HTML Google receives.",
      "After deploying, press Ctrl+U on each page and search for `rel=\"canonical\"`.",
    ],
    wordpress: [
      "WordPress and plugins like Yoast or Rank Math add this tag automatically. If you don't have one: Plugins → Add New → search \"Yoast SEO\" → Install → Activate.",
      "If a page points to another website, open it (Pages → Edit). Yoast: open the Yoast box → \"Advanced\" → \"Canonical URL\". Rank Math: Rank Math icon → \"Advanced\" tab → \"Canonical URL\".",
      "Empty that field (it then uses the page's own address) or type the address from the 'Change it to' column. Click Update.",
      "Check Settings → General: \"WordPress Address\" and \"Site Address\" should both be your real address (with https:// and www if you use it).",
      "If the tag is still missing, your theme may not load plugin output — ask your developer to check that `header.php` calls `wp_head()`.",
    ],
    shopify: [
      "Shopify themes add this tag automatically on every page — you normally don't have to do anything.",
      "If we found it missing or pointing elsewhere: Online Store → Themes → ⋯ → Edit code → open `layout/theme.liquid`.",
      "Inside `<head>`, there should be exactly one line `<link rel=\"canonical\" href=\"{{ canonical_url }}\">`. Add it if missing; remove any other canonical line with a fixed address. (Or ask a Shopify expert.)",
      "Settings → Domains: make sure your own domain is set as the primary domain, so all copies point to it.",
      "Save, then check the page source.",
    ],
    wix: [
      "Wix adds this tag automatically, using your primary domain.",
      "Check your domain: Dashboard → Settings → Domains — your own domain should be marked as primary.",
      "If a page points to another website: open the Editor → Pages & Menu → ⋯ next to the page → \"SEO basics\" → \"Advanced SEO\" tab and look at the canonical setting.",
      "Clear the wrong address (so Wix uses the page's own address) or type the address from the 'Change it to' column.",
      "Click Publish.",
    ],
    webflow: [
      "Open Site settings → \"SEO\" tab.",
      "Under \"Global canonical tag URL\", type your main address, e.g. `https://www.yourdomain.com` (no slash at the end). Webflow then adds the right tag to every page.",
      "Click Save changes and Publish.",
      "If a page points to another website, open that page's settings → \"Custom code\" → \"Inside <head> tag\" and delete any hand-written canonical line.",
    ],
    framer: [
      "Framer adds this tag automatically, using your primary domain.",
      "Open Site settings → Domains and make sure your own domain is the primary one (not the framer.app address).",
      "If a page points to another website, check Site settings → General → \"Custom Code\" and the page's own settings for a hand-written canonical line and delete it.",
      "Click Publish.",
    ],
    squarespace: [
      "Squarespace adds this tag automatically, using your primary domain.",
      "Go to Settings → Domains and make sure your own domain is set as primary.",
      "If a page points to another website, check Settings → Developer Tools → \"Code Injection\" (and the page's own \"Advanced\" tab) for a hand-written canonical line and delete it.",
      "Save your changes.",
    ],
    custom: [
      "Each page should have `<link rel=\"canonical\" href=\"…\">` inside `<head>`, pointing at that page's own preferred address (with https, your chosen www or non-www, no tracking bits after \"?\").",
      "Use the addresses in the 'Change it to' column.",
      "Never point all pages at the home page, and never at another website unless you copied that content on purpose.",
      "Send the list to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs:
      "Set `metadataBase` in app/layout.tsx, then `alternates: { canonical: '<path>' }` per page (and in generateMetadata for dynamic routes). Do NOT set alternates.canonical in the root layout (it is inherited by every route). Fix any canonical pointing to a different host. The canonical must be the page's own absolute https URL, consistent www/non-www and trailing slash policy.",
    react:
      "SPA: remove any hard-coded canonical from index.html; add a per-route <link rel=\"canonical\"> (react-helmet-async or React 19 <link> in components) and pre-render routes so it's in the served HTML.",
    custom: "Render <link rel=\"canonical\" href=\"<own absolute URL>\"> in the <head> of each page, self-referencing, https, consistent host and trailing slash; remove canonicals pointing to other hosts.",
  },
  verify: [
    "Open each page, press Ctrl+U (Cmd+Option+U on Mac) to view the page source and search for rel=\"canonical\". It should show that page's own address.",
    CHECK_AGAIN,
    "Optional: in Google Search Console use \"URL inspection\" on a page — \"Google-selected canonical\" should match your address after Google visits again.",
  ],
  time: "15–30 minutes",
  category: "technical",
};

// ---------------------------------------------------------------- Image descriptions (alt)

export const imageAltGuide: FixGuide = {
  effect: (ctx) => {
    const missing = ctx.pages.reduce((a, p) => a + imagesWithoutDescription(p).length, 0);
    return `${missing ? count(missing, "image") : "Several images"} across ${count(affected(ctx), "page")} ${missing === 1 ? "has" : "have"} no image description, so Google, AI tools and blind visitors using screen readers can't tell what they show.`;
  },
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const bad = imagesWithoutDescription(p);
      const total = p.extracted?.images.length ?? 0;
      const names = bad.slice(0, 3).map((i) => clip(fileName(i.src), 30));
      return {
        page: pageName(p.url),
        now: bad.length
          ? `${bad.length} of ${count(total, "image")} without description: ${names.join(", ")}${bad.length > 3 ? ", …" : ""}`
          : "Some images have no description",
        change: `Describe each picture in a few words, e.g. “${clip(topicOf(p, ctx.brand), 40)} – what the photo shows”. Leave empty only for decoration.`,
      };
    }),
  steps: {
    nextjs: [
      "Search your code for `<Image` (from `next/image`) and `<img`. Each one needs an `alt` with a few words saying what the picture shows, e.g. `alt=\"Technician fixing a boiler in a kitchen\"`.",
      "For decorative pictures (patterns, dividers), use `alt=\"\"` on purpose — that tells screen readers to skip it.",
      "For images that come from a CMS or database, pass the description field through: `alt={item.imageAlt ?? item.title}` — and fill that field in your CMS.",
      "Run `npx next lint` (it includes a rule that flags images without `alt`) and fix what it lists.",
      "Use the 'Change it to' list above to find which pages and image files still need it. Deploy and check again.",
    ],
    react: [
      "Search your code for `<img` and image components. Each needs an `alt` with a few words describing the picture.",
      "Decorative pictures get `alt=\"\"` on purpose.",
      "For images from a CMS or API, pass the description field into `alt` and fill it in for each item.",
      "Add the `eslint-plugin-jsx-a11y` rule `jsx-a11y/alt-text` to catch new ones automatically.",
      "Use the list above to find which pages and image files need it. Deploy and check again.",
    ],
    wordpress: [
      "Log in to WordPress and open the page from the list (Pages → Edit).",
      "Click each image in the editor. In the right-hand panel (Block settings) fill in \"Alternative text\" with a few words describing the picture.",
      "Important: changing the text in Media → Library doesn't update images already placed on pages — fix them on the page itself as above.",
      "For new uploads, fill in \"Alternative Text\" in Media → Library → click the image before you insert it.",
      "Elementor: click the image → Content tab → check the image's description in the media window. WooCommerce product images: Products → Edit → click the product image → \"Alternative Text\".",
      "Click Update. Leave the field empty only for purely decorative pictures.",
    ],
    shopify: [
      "Product pictures: Products → open the product → click an image under Media → \"Add alt text\" → type a few words (e.g. \"Blue linen shirt, front view\") → Save.",
      "Collection pictures: Products → Collections → open the collection → click the image → \"Edit alt text\".",
      "Pictures in theme sections (banners, slideshows): Online Store → Themes → Customize → select the section → click the image → fill in its image description field.",
      "Pictures uploaded in Content → Files: click the file → \"Add alt text\".",
      "Pictures inside page or blog text: open the page → click the image in the editor → image settings → fill in \"Alt text\".",
      "Work through the pages in the list above, starting with the most visited.",
    ],
    wix: [
      "Open your site in the Wix Editor and go to the page from the list.",
      "Click an image → the gear icon (Settings).",
      "Fill in \"What's in the image? Tell Google\" with a few words describing the picture.",
      "For galleries: click the gallery → \"Manage Media\" → select each picture → fill in its description field.",
      "For store products: Store Products → open the product → click the image → add a description of the image.",
      "Repeat for every image on the pages in the list, then click Publish.",
    ],
    webflow: [
      "Open the Assets panel (left side, or press J).",
      "Hover an image → click the gear icon → fill in \"Alt text\" → Save. This becomes the default everywhere the image is used.",
      "On the page, select an image and open the Settings panel (D): make sure \"Alt text\" is set to use the asset's description, or type a custom one. Choose \"Decorative\" only for decoration.",
      "For CMS images: open each collection item and fill in the image's description field, or connect the image to a text field in the template.",
      "Click Publish.",
    ],
    framer: [
      "Open the page in Framer.",
      "Select an image (or a frame with an image fill).",
      "In the right-hand panel under the image settings, fill in \"Alt Text\" with a few words describing the picture.",
      "For CMS images, add a text field for the description in the collection and connect it to the image.",
      "Click Publish.",
    ],
    squarespace: [
      "Open the page in Squarespace and click Edit.",
      "Click an image block → the pencil (edit) icon.",
      "Fill in the image's description field (\"Alt text\" or \"Image alt text\" in the Content tab, depending on your version).",
      "Gallery images: click the gallery → edit → click each image's gear icon → fill in its description.",
      "Product images: Commerce → Products → open the product → click each image → add its description.",
      "Click Save and repeat for every page in the list.",
    ],
    custom: [
      "Every `<img>` tag needs an `alt=\"…\"` with a few words saying what the picture shows.",
      "Use `alt=\"\"` (empty on purpose) only for decorative pictures.",
      "The 'Change it to' list shows which pages and image files are missing it.",
      "Send the list to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs:
      "Add meaningful `alt` to every next/image <Image> and <img>; decorative images get alt=\"\". For CMS/DB images pass the stored description into alt (add a field if needed). Enable/obey the jsx-a11y/alt-text lint rule (included in `next lint`). Use the page list and image file names to find the components.",
    react:
      "Add meaningful `alt` to every <img>/image component; decorative ones get alt=\"\". Pass CMS/API description fields into alt. Add eslint-plugin-jsx-a11y with jsx-a11y/alt-text.",
    custom: "Add a descriptive alt attribute to every <img> (alt=\"\" for decorative images) in the templates/content that produce the listed pages.",
  },
  verify: [
    "Open a page, right-click a picture → \"Inspect\" and check it has alt=\"…\" with your words.",
    CHECK_AGAIN,
  ],
  time: "1–2 minutes per image (about 30–90 minutes in total)",
  category: "onsite",
};

// ---------------------------------------------------------------- Share previews (Open Graph)

export const openGraphGuide: FixGuide = {
  effect: (ctx) =>
    `When someone shares ${affected(ctx) === 1 ? "this page" : `these ${affected(ctx)} pages`} on WhatsApp, Facebook or LinkedIn, the link shows without a proper title or picture, so it gets noticed and clicked less.`,
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const og = p.extracted?.openGraph;
      const missing = [!og?.title && "title", !og?.image && "picture"].filter(Boolean).join(" and ");
      return {
        page: pageName(p.url),
        now: missing ? `No share ${missing}` : "Share preview incomplete",
        change: `Title: “${p.extracted?.title ? clip(p.extracted.title, 60) : suggestTitle(p, ctx.brand)}” + a 1200×630 picture of ${clip(topicOf(p, ctx.brand), 40)}`,
      };
    }),
  steps: {
    nextjs: [
      "Set a default for the whole site: put a 1200×630 picture named `opengraph-image.jpg` (or `.png`) in the `app` folder. Next.js adds it to every page automatically.",
      "Make sure `app/layout.tsx` sets `metadataBase: new URL(\"https://www.yourdomain.com\")`, so the picture address is complete.",
      "For a page with its own preview, add to its `metadata`: `openGraph: { title: \"…\", description: \"…\", images: [\"/images/services-og.jpg\"] }`.",
      "Careful: a page's `openGraph` replaces the layout's whole `openGraph` — include `images` again on every page that sets its own.",
      "For pages made from data (blog posts, products), return `openGraph` with the item's own picture from `generateMetadata`, or add an `opengraph-image.tsx` in that route folder.",
      "Deploy and test a link with the Facebook Sharing Debugger (see the checks below).",
    ],
    react: [
      "WhatsApp, Facebook and LinkedIn never run JavaScript, so on a plain React app they only see `index.html`.",
      "Add a default share preview to `index.html` inside `<head>`: `<meta property=\"og:title\" content=\"<Brand>\">`, `<meta property=\"og:description\" content=\"…\">` and `<meta property=\"og:image\" content=\"https://www.yourdomain.com/share.jpg\">` (a 1200×630 picture in `public`).",
      "For each page to have its own preview, pre-render your pages (`vite-react-ssg` or `react-snap`) and set the tags per page with `react-helmet-async`.",
      "Deploy and test a link with the Facebook Sharing Debugger.",
    ],
    wordpress: [
      "Make sure Yoast or Rank Math is installed (Plugins → Add New → search \"Yoast SEO\").",
      "Set a default picture for the whole site. Yoast: Yoast → Settings → \"Site basics\" → \"Site image\". Rank Math: Rank Math → Titles & Meta → Global Meta → \"OpenGraph Thumbnail\". Use a 1200×630 picture.",
      "For each page in the list: Pages → Edit. Yoast: in the Yoast box open the \"Social\" tab (\"Social appearance\") → add a title and image. Rank Math: icon at top right → \"Edit Snippet\" → \"Social\" tab.",
      "Giving each page a \"Featured image\" (right-hand panel) also works — the plugins use it as the share picture.",
      "Click Update and test a link with the Facebook Sharing Debugger.",
    ],
    shopify: [
      "Most Shopify themes create share previews automatically from the page title, its \"Search engine listing\" text and the main picture.",
      "Set the default picture: Online Store → Themes → Customize → Theme settings (gear icon) → \"Social media\" → \"Social sharing image\" → upload a 1200×630 picture → Save.",
      "Products and collections use their first picture — make sure each one has a good main image.",
      "For pages and blog posts, add a featured image (blog posts) and fill in \"Search engine listing\" so the preview has good text.",
      "Test a link with the Facebook Sharing Debugger.",
    ],
    wix: [
      "Open the Wix Editor → Pages & Menu → hover the page → ⋯ → \"Social share\".",
      "Upload a 1200×630 picture and check the title and description.",
      "Repeat for every page in the list.",
      "For blog posts and products, Wix uses their cover/main picture — make sure each has one.",
      "Click Publish, then test a link with the Facebook Sharing Debugger.",
    ],
    webflow: [
      "Open the Pages panel → hover the page → gear icon (Page settings).",
      "Scroll to \"Open Graph settings\". Tick \"Same as SEO title\" / \"Same as SEO description\", or write your own.",
      "Upload a 1200×630 picture under \"Open Graph image\". For CMS templates, connect the image to the item's main picture field.",
      "Click Save, then Publish, and test a link with the Facebook Sharing Debugger.",
    ],
    framer: [
      "Set the default: Site settings → General → \"Social Preview\" → upload a 1200×630 picture.",
      "For a page with its own preview: Pages panel → page settings → \"Social Preview\" → upload a picture.",
      "For CMS pages, connect the social preview to the item's image in the CMS page settings.",
      "Click Publish and test a link with the Facebook Sharing Debugger.",
    ],
    squarespace: [
      "Go to Pages → hover the page → gear icon → \"Social Image\" tab → upload a 1200×630 picture.",
      "Set a default for the whole site: open Settings and search \"social sharing\" → upload the \"Social sharing logo\" / image.",
      "For blog posts and products, set a thumbnail/main picture — Squarespace uses it when shared.",
      "Click Save and test a link with the Facebook Sharing Debugger.",
    ],
    custom: [
      "Each page needs these tags in `<head>`: `<meta property=\"og:title\" content=\"…\">`, `<meta property=\"og:description\" content=\"…\">`, `<meta property=\"og:image\" content=\"https://…/picture.jpg\">` and `<meta property=\"og:url\" content=\"…\">`.",
      "The picture address must be complete (start with https://) and the picture about 1200×630 pixels.",
      "The tags must be in the HTML the server sends — WhatsApp and Facebook don't run JavaScript.",
      "Send the 'Change it to' list to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs:
      "Use the Metadata API: `metadataBase` in app/layout.tsx; a default app/opengraph-image.(jpg|png|tsx) file convention; per-route `openGraph: { title, description, url, images }` in metadata/generateMetadata. Note child `openGraph` objects REPLACE the parent's (no deep merge) — repeat `images` where overridden. Add `twitter: { card: 'summary_large_image' }` too.",
    react:
      "Social scrapers don't execute JS. Put default og:title/og:description/og:image (absolute URL, 1200×630) in index.html, then pre-render routes (vite-react-ssg / react-snap) with per-route og tags via react-helmet-async.",
    custom: "Render og:title, og:description, og:image (absolute https URL, 1200×630), og:url and twitter:card=summary_large_image in each page's server-side <head>.",
  },
  verify: [
    "Paste the page address into the Facebook Sharing Debugger (developers.facebook.com/tools/debug) and click \"Scrape Again\" — you should see the title and picture.",
    "Or send the link to yourself on WhatsApp — the preview should show a picture and title. (Old previews can be cached for a while.)",
    CHECK_AGAIN,
  ],
  time: "20–40 minutes",
  category: "onsite",
};
