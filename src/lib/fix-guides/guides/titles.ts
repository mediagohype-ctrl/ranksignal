// Google headlines (<title>): missing, too long/short, or the same on many pages.
// This is the reference guide: other guides follow its shape and level of detail.
import type { FixGuide } from "../types";
import { clip, pageName, suggestTitle } from "../helpers";

export const titlesGuide: FixGuide = {
  effect: (ctx) =>
    `Google shows ${ctx.issue.affectedCount} of your pages with a headline that doesn't describe them, so people can't tell them apart in search results, and Google and AI tools may pick the wrong page — or skip them.`,
  changes: (ctx) =>
    ctx.pages.map((p) => ({
      page: pageName(p.url),
      now: p.extracted?.title ? clip(p.extracted.title, 70) : "(no headline)",
      change: suggestTitle(p, ctx.brand),
    })),
  steps: {
    nextjs: [
      "Open your project's code (or ask your developer). Find the `app` folder — each page has its own folder, e.g. `app/about/page.tsx` is the /about page.",
      "Open `app/layout.tsx` and set a headline template so every page gets your brand name automatically: `export const metadata = { title: { default: \"<Brand> – <what you do>\", template: \"%s | <Brand>\" } }`.",
      "In each page file (e.g. `app/about/page.tsx`) add `export const metadata = { title: \"About us\" }`. Use the 'Change it to' column above — write only the topic part; the template adds \"| <Brand>\".",
      "If a page file starts with `\"use client\"`, it can't export metadata. Keep the client code in a separate component and make `page.tsx` a normal (server) file that exports `metadata` and renders that component.",
      "For pages made from data (blog posts, products, e.g. `app/blog/[slug]/page.tsx`), export `async function generateMetadata({ params })` that returns `{ title: post.title }`.",
      "Using the older `pages` folder instead of `app`? In each page add `import Head from \"next/head\"` and `<Head><title>About us | <Brand></title></Head>`.",
      "Deploy, then open each page, press Ctrl+U (view source) and search for `<title>` — you should see the new headline in the raw page.",
    ],
    react: [
      "Your site is a single-page React app: every address loads the same `index.html`, so Google and AI tools that don't run JavaScript see the same headline on every page. That's why they all look identical.",
      "Quick improvement: install `react-helmet-async` (or, on React 19, put a `<title>` tag inside each page component) and give every page its own headline from the 'Change it to' column.",
      "Real fix: pre-render your pages so each address is saved as its own HTML file with its own headline. With Vite use a pre-render plugin (e.g. `vite-plugin-prerender` or `vite-react-ssg`); with Create React App use `react-snap`.",
      "Best long-term fix: move the site to a framework that builds every page on the server, like Next.js or Astro. Ask your developer — it removes this and the 'empty page' problem together.",
      "After deploying, open each page, press Ctrl+U and search for `<title>`. If you still see the same headline everywhere, pre-rendering isn't working yet.",
    ],
    wordpress: [
      "Log in to WordPress (yoursite.com/wp-admin).",
      "If you don't have an SEO plugin: go to Plugins → Add New, search \"Yoast SEO\" (or \"Rank Math\"), click Install, then Activate.",
      "Go to Pages (or Posts) and click Edit on the first page from the list above.",
      "Yoast: scroll below the editor to the \"Yoast SEO\" box → \"SEO title\". Rank Math: click the Rank Math icon at the top right → \"Edit Snippet\" → \"Title\".",
      "Delete what's there and type the headline from the 'Change it to' column. Click Update.",
      "Repeat for every page in the list. To set a default for all pages: Yoast → Settings → Content types → Pages → SEO title `%%title%% %%sep%% %%sitename%%`.",
      "If every page still shows the same headline, your theme may be overriding it: Appearance → Theme File Editor → `header.php` should NOT contain a hard-coded `<title>` tag — ask your developer to remove it.",
    ],
    shopify: [
      "Open your Shopify admin.",
      "For the home page: Online Store → Preferences → \"Homepage title\". Type the new headline and click Save.",
      "For other pages: Online Store → Pages (or Products / Collections / Blog posts) → open the page.",
      "Scroll to \"Search engine listing\" at the bottom → click Edit → change \"Page title\" to the one in the 'Change it to' column → Save.",
      "Repeat for every page in the list.",
    ],
    wix: [
      "Open your site in the Wix Editor.",
      "Click Pages & Menu on the left, hover the first page in the list, click the ⋯ (more) icon → SEO basics.",
      "Under \"Title tag\", type the headline from the 'Change it to' column.",
      "Repeat for every page, then click Publish at the top right.",
      "To set a default for all pages: Dashboard → Marketing & SEO → SEO Settings → Edit by page type.",
    ],
    webflow: [
      "Open your project in the Webflow Designer.",
      "Open the Pages panel (left side), hover the page and click the gear icon (Page settings).",
      "Under \"SEO settings\" → \"Title tag\", type the headline from the 'Change it to' column. Click Save.",
      "For CMS pages (blog posts, collections): open the Collection template's settings and set the title to use a field, e.g. `{Name} | <Brand>`.",
      "Click Publish.",
    ],
    framer: [
      "Open your project in Framer.",
      "In the Pages panel on the left, hover the page and click the ⋯ / settings icon (Page settings).",
      "Under SEO, fill in \"Title\" with the headline from the 'Change it to' column.",
      "For CMS pages, open the CMS page settings and set the Title using the item's name variable, then add \" | <Brand>\".",
      "Click Publish at the top right.",
    ],
    squarespace: [
      "Open your site in Squarespace and go to Pages.",
      "Hover the page, click the gear icon → SEO tab.",
      "Type the headline from the 'Change it to' column in \"SEO title\". Click Save.",
      "To set the format for all pages: Marketing → SEO → Search appearance → Pages → `%p | %s`.",
      "Repeat for every page in the list.",
    ],
    custom: [
      "Every page's HTML has a `<title>` tag inside `<head>`. That text is the headline Google shows.",
      "Give each page its own headline from the 'Change it to' column: \"Page topic | Brand\", under 60 characters.",
      "If your site builds pages with JavaScript, make sure the `<title>` is already in the HTML the server sends (server-side rendering or pre-rendering), not only added later by JavaScript.",
      "Send the 'Change it to' list to your web developer, or paste the AI prompt below into an AI coding assistant inside your project.",
    ],
  },
  promptHints: {
    nextjs:
      "This is a Next.js site. Use the Metadata API: a title template in app/layout.tsx (`title: { default, template: \"%s | Brand\" }`), `export const metadata` in each app/**/page.tsx, and `generateMetadata` for dynamic routes. Pages that are \"use client\" cannot export metadata — split them into a server page.tsx that exports metadata and renders the client component. If the project uses the pages/ router, use next/head instead.",
    react:
      "This is a client-side React single-page app, so crawlers only see index.html. Add per-route titles (react-helmet-async, or React 19 <title> in components) AND set up pre-rendering (vite-react-ssg / vite-plugin-prerender for Vite, react-snap for CRA) so each route is served as its own HTML file containing its <title>.",
    custom: "Find where each page's <head> is produced (templates, layouts or components) and set a unique <title> per page in the server-rendered HTML.",
  },
  verify: [
    "Open each page in your browser and look at the tab name — it should show the new headline.",
    "Press Ctrl+U (Cmd+Option+U on Mac) to view the page source and search for <title>. The new headline must be there; if it's only visible in the tab but not in the source, Google and AI tools may still not see it.",
    "Click \"Check website\" on Home. This problem should disappear from your list.",
    "Google updates its results in a few days to a few weeks.",
  ],
  time: "10 minutes per page (about 30–60 minutes in total)",
  category: "onsite",
};
