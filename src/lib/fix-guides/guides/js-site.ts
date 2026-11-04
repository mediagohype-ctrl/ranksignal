// "AI tools can't read your site because it needs JavaScript" (check seo.js_rendering, src/lib/report/checks/js-site.ts).
// The page arrives as an empty shell and the words appear only after JavaScript runs. Fix: send pages with their
// words already in the HTML (server-side rendering or pre-rendering).
import type { FixGuide } from "../types";
import { pageName } from "../helpers";

const CHECK_AGAIN = "Click \"Check website\" on Home. This problem should disappear, and your other page checks come back.";

export const jsSiteGuide: FixGuide = {
  effect: (ctx) =>
    `${ctx.issue.affectedCount} of your pages arrive empty, so ChatGPT, Perplexity and other AI tools see a blank page and can't quote or recommend you. Google reads them late, if at all.`,
  changes: (ctx) =>
    ctx.pages.slice(0, 20).map((p) => ({
      page: pageName(p.url),
      now: `${p.extracted?.wordCount ?? 0} words before JavaScript runs`,
      change: "Send the page with its words already in it (server-side rendering or pre-rendering).",
    })),
  steps: {
    nextjs: [
      "Open your project's code (or ask your developer) and find the `app` folder. Each page is a `page.tsx` file, e.g. `app/about/page.tsx`.",
      "Open each `page.tsx`. If the first line is `\"use client\"`, the whole page is built in the browser. Remove that line from the page file.",
      "Move the interactive parts (buttons with onClick, forms, sliders, anything using useState or useEffect) into their own small file that starts with `\"use client\"`, and use it inside the page.",
      "Load the page's data on the server: make the page `async` and `await` your data (fetch, database) in the page itself, instead of loading it in `useEffect`.",
      "Check `app/layout.tsx` too: if it starts with `\"use client\"` or wraps everything in a provider that waits for the browser before showing children, move that into a small client component.",
      "Using the older `pages` folder? Use `getStaticProps` or `getServerSideProps` so pages are built on the server, and don't hide content behind `dynamic(..., { ssr: false })`.",
      "Deploy, then open a page, press Ctrl+U (view source) and search for a sentence from the page. You should find it in the code.",
    ],
    react: [
      "Your site is a single-page React app: every address loads the same nearly empty `index.html`, and JavaScript fills it in. AI tools never run that JavaScript.",
      "Quickest fix — pre-render: build every page into its own HTML file when the site is built. With Vite, use Vike (vite-plugin-ssr) or `vite-react-ssg`; with Create React App, use `react-snap` (add `\"postbuild\": \"react-snap\"` to package.json).",
      "Make sure every page address is listed for the pre-renderer (most follow your links; add the rest in its settings).",
      "Give each page its own Google headline and summary while you're at it (React 19: put `<title>` and `<meta name=\"description\">` in each page component; older React: react-helmet-async).",
      "Best long-term fix: move the site to Next.js (or Astro), which sends every page with its words already in it. Ask your developer — it fixes this for good.",
      "Deploy, then open a page, press Ctrl+U and search for a sentence from the page. If you only see `<div id=\"root\"></div>`, pre-rendering isn't working yet.",
    ],
    custom: [
      "Ask your web developer: \"Our pages arrive empty and are filled in by JavaScript. Please switch on server-side rendering or pre-rendering so every page's HTML already contains its text.\"",
      "Vue: use Nuxt (server rendering or `nuxi generate`). Angular: add Angular SSR (`ng add @angular/ssr`) or prerendering. Svelte: use SvelteKit with prerender switched on.",
      "Other site builders: look for a setting called \"SEO mode\", \"server rendering\" or \"pre-render\" and switch it on, or ask the builder's support team.",
      "When it's live, open a page, press Ctrl+U and search for a sentence from the page. You should find it in the code.",
    ],
  },
  promptHints: {
    nextjs: "Pages are client-rendered. Convert app/**/page.tsx to React Server Components: remove \"use client\" from pages/layouts, fetch data in async server components, keep interactivity in small client components, avoid dynamic(..., { ssr: false }) for main content. Verify text is present in the initial HTML (view-source).",
    react: "This is a client-side rendered React SPA (empty #root). Add build-time prerendering (Vike/vite-plugin-ssr or vite-react-ssg for Vite; react-snap for CRA) for every route, or migrate to Next.js App Router with server components. Verify text is present in the initial HTML (view-source).",
    custom: "The site is client-side rendered (empty HTML shell). Enable SSR or static prerendering in the framework so the initial HTML contains the page text, title and meta description for every route.",
  },
  verify: [
    "Open a few pages, press Ctrl+U (view source) and search for a sentence you can see on the page — it should be in the code.",
    CHECK_AGAIN,
  ],
  time: "A few hours to a few days for a developer",
  category: "technical",
};
