// Technical guides: pages that can appear on Google, forwarding hops, page list (sitemap), padlock (HTTPS),
// phone setting (viewport) and page size.
import type { FixGuide, FixPage } from "../../types";
import { pageName } from "../../helpers";
import { affected, count } from "./shared";

const CHECK_AGAIN = "Click \"Check website\" on Home. This problem should disappear from your list.";
const isHidden = (p: FixPage) => /\bnoindex\b|\bnone\b/i.test(p.extracted?.robotsMeta ?? "");

// ---------------------------------------------------------------- Pages that can appear on Google (errors + noindex)

export const indexabilityGuide: FixGuide = {
  effect: (ctx) => {
    const hidden = ctx.pages.filter(isHidden).length;
    const broken = Math.max(0, affected(ctx) - hidden);
    const parts = [
      broken ? `${count(broken, "page")} show${broken === 1 ? "s" : ""} an error or didn't load` : "",
      hidden ? `${count(hidden, "page")} ${hidden === 1 ? "is" : "are"} set to stay hidden from Google` : "",
    ].filter(Boolean);
    return `${parts.join(" and ")}, so ${affected(ctx) === 1 ? "it can't" : "they can't"} show up on Google, and AI tools are unlikely to use ${affected(ctx) === 1 ? "it" : "them"}.`;
  },
  changes: (ctx) =>
    ctx.pages.map((p) => {
      const hidden = isHidden(p);
      return {
        page: pageName(p.url),
        now: p.note ?? (hidden ? "Set to stay hidden from Google." : "Shows an error or didn't load."),
        change: hidden
          ? "Switch the hiding setting off — unless this page should stay private (thank-you, login, cart)."
          : "Bring the page back, or forward its address to the closest working page.",
      };
    }),
  steps: {
    nextjs: [
      "Hidden pages: search your code for `index: false`, `noindex` and `robots:`. In the page's `metadata` remove `robots: { index: false }` (or set `index: true`). Check `app/layout.tsx` too — a hide setting there hides every page.",
      "Also check for a hide setting meant only for test sites, e.g. `robots` set from an environment variable, and for an `X-Robots-Tag` header in `next.config.js` (`headers()`) or `middleware.ts`.",
      "Error pages: open each address from the list. If the page should exist, check the route folder (e.g. `app/services/page.tsx`) exists and the page doesn't throw an error or call `notFound()` for valid items.",
      "If the page moved or was removed on purpose, forward the old address: in `next.config.js` add `{ source: \"/old\", destination: \"/new\", permanent: true }` to `async redirects()`.",
      "Deploy, then open each address and view the source (Ctrl+U): no `noindex`, and the page loads normally.",
    ],
    react: [
      "Hidden pages: check `index.html` and your page components for `<meta name=\"robots\" content=\"noindex\">` and remove it from pages that should be found.",
      "Error pages: on a single-page app, opening an address directly (not by clicking) can give a \"404\" from your host. Make the host send every address to `index.html`: on Netlify add `/* /index.html 200` to `public/_redirects`; on Vercel add a rewrite in `vercel.json`; on Apache use `.htaccess` fallback rules.",
      "If a page was removed on purpose, forward its old address to the closest page (same files as above, with a 301).",
      "Check your router has a route for every address in the list.",
      "Deploy, then open each address directly in a new tab — it should load without an error.",
    ],
    wordpress: [
      "Whole site hidden? Settings → Reading → \"Search engine visibility\" — untick \"Discourage search engines from indexing this site\" → Save Changes.",
      "Single pages hidden: Pages → Edit the page. Yoast: Yoast box → \"Advanced\" → \"Allow search engines to show this page in search results?\" → Yes. Rank Math: icon → \"Advanced\" tab → Robots Meta → tick \"Index\". Click Update.",
      "Keep hidden only pages meant to be private (thank-you, cart, my account, login).",
      "Error pages: if a page was deleted by mistake, restore it from Pages → Trash. If it moved, install the \"Redirection\" plugin → Tools → Redirection → Add new (old address → new page).",
      "If many pages show errors after a change, go to Settings → Permalinks and just click Save Changes — this resets WordPress's address rules.",
    ],
    shopify: [
      "Is the whole store hidden behind a password? Online Store → Preferences → \"Password protection\" → untick \"Restrict access to visitors with the password\" → Save (only possible on a paid plan).",
      "Single pages hidden: hiding is usually done by an app or theme code. Check apps you've installed for a \"hide from search\" option, and in Online Store → Themes → ⋯ → Edit code → `layout/theme.liquid` look for `noindex` (ask a Shopify expert if unsure).",
      "Products that are \"Draft\" or not available on the \"Online Store\" sales channel show an error page: Products → open it → set Status to \"Active\" and tick the Online Store channel.",
      "Pages that were deleted or renamed: Online Store → Navigation → \"URL Redirects\" → Create URL redirect from the old address to the closest working page.",
      "Save and open each address to check it loads.",
    ],
    wix: [
      "Hidden pages: Pages & Menu → ⋯ next to the page → \"SEO basics\" → switch on \"Let search engines index this page\" (wording may be \"Show this page in search results\").",
      "Pages set to members-only or password-protected (Pages & Menu → ⋯ → \"Permissions\") can't appear on Google — set them to \"Everyone\" if they should be public.",
      "Error pages: if a page was deleted or renamed, forward the old address: Dashboard → \"Marketing & SEO\" → \"SEO Tools\" → \"URL Redirect Manager\" → New Redirect.",
      "Click Publish, then open each address to check it loads.",
    ],
    webflow: [
      "Hidden pages: open the page's settings (gear icon in the Pages panel) → \"Custom code\" → \"Inside <head> tag\" and delete any line containing `noindex`. Check Site settings → \"Custom code\" too, which applies to every page.",
      "Check the page isn't password protected: page settings → \"Password protection\".",
      "Draft pages and CMS items that aren't published show an error — publish them, or remove links to them.",
      "Pages deleted or renamed: Site settings → \"Publishing\" (older: \"Hosting\") → \"301 redirects\" → add old path → new page.",
      "Click Publish.",
    ],
    framer: [
      "Hidden pages: open the page settings in the Pages panel and make sure search indexing for the page is switched on (the option to hide it from search engines is off).",
      "Check Site settings → General → \"Custom Code\" for any line containing `noindex` and delete it.",
      "Make sure the site is published to your own domain and not password protected (Site settings → General).",
      "Pages deleted or renamed: Site settings → \"Redirects\" → add old path → new page.",
      "Click Publish.",
    ],
    squarespace: [
      "Whole site private? Settings → \"Site availability\" → choose \"Public\" → Save.",
      "Hidden pages: Pages → gear icon on the page → \"SEO\" tab → switch off \"Hide page from search engine results\".",
      "Disabled or password-protected pages (page settings → \"General\" / \"Page password\") also can't appear — enable them or remove the password if they should be public.",
      "Pages deleted or renamed: Settings → Developer Tools → \"URL Mappings\" → add `/old-page -> /new-page 301` → Save.",
      "Check Settings → Developer Tools → \"Code Injection\" for a hand-written `noindex` line and remove it.",
    ],
    custom: [
      "Hidden pages: remove `<meta name=\"robots\" content=\"noindex\">` (and any `X-Robots-Tag: noindex` header) from pages that should be found. Keep it only on private pages.",
      "Error pages: make each listed address load normally (status 200), or send it to the closest working page with a permanent (301) redirect.",
      "Check the list for pages that time out or crash on the server and fix their errors.",
      "Send the list to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs:
      "Search for `robots: { index: false }`, `noindex`, X-Robots-Tag in next.config headers() and middleware.ts, including env-dependent logic (e.g. noindex when not production) that may be leaking into production. For 4xx/5xx URLs: ensure the route exists, doesn't call notFound() for valid data, and server errors are fixed; add permanent redirects in next.config redirects() for moved/removed pages.",
    react:
      "Remove robots noindex meta from index.html/components for public routes. Configure the host's SPA fallback (Netlify `/* /index.html 200`, vercel.json rewrites, nginx try_files) so deep links don't 404, while unknown routes render a proper not-found page. Add 301s for removed routes.",
    custom: "Remove noindex robots meta / X-Robots-Tag headers from public pages; make listed URLs return 200 or 301 to the closest equivalent; fix server errors.",
  },
  verify: [
    "Open each address from the list in a new browser tab — it should load normally.",
    "View the source (Ctrl+U) and search for noindex — it shouldn't be there on pages you want found.",
    "Optional: in Google Search Console use \"URL inspection\" → \"Request indexing\" for your most important pages.",
    CHECK_AGAIN,
  ],
  time: "15–60 minutes",
  category: "technical",
};

// ---------------------------------------------------------------- Pages that load in one hop (redirect chains)

export const redirectsGuide: FixGuide = {
  effect: (ctx) =>
    `${count(affected(ctx), "page")} can only be reached after being forwarded two or more times (for example http → https → www), which slows ${affected(ctx) === 1 ? "it" : "them"} down and Google may give up on long chains.`,
  steps: {
    nextjs: [
      "The usual chain is: http:// → https:// → www → address with or without a slash at the end. Decide on one final form, e.g. `https://www.yourdomain.com/services`.",
      "On Vercel: Project → Settings → Domains. Set the domain you want as the main one and make the other (with or without www) redirect straight to it.",
      "In `next.config.js`, check `trailingSlash` matches how your links are written, and that entries in `async redirects()` point straight at the final address — not at another redirect.",
      "Update links in your menus, footer and content to use the final address, so visitors never hit a redirect at all.",
      "Deploy and test the old addresses (see the checks below).",
    ],
    react: [
      "Decide on one final form of your address, e.g. `https://www.yourdomain.com/services`.",
      "On your host's domain settings (Vercel: Project → Settings → Domains; Netlify: Domain management) make the non-main domain forward straight to the main one.",
      "Check `vercel.json` / `public/_redirects` so each rule points straight at the final address, not at another rule.",
      "Update links in your menus and content to use the final address.",
      "Deploy and test the old addresses.",
    ],
    wordpress: [
      "Settings → General: make sure \"WordPress Address\" and \"Site Address\" are both exactly your final address (e.g. `https://www.yourdomain.com`). A mismatch here adds an extra hop.",
      "Tools → Redirection (the \"Redirection\" plugin): look for rules that point to another redirected address and change their target to the final page.",
      "Update links in menus (Appearance → Menus) and pages to the final address. The \"Better Search Replace\" plugin can swap an old address for the new one everywhere.",
      "Ask your host to forward http:// and non-www straight to the final https:// www address in one step.",
    ],
    shopify: [
      "Settings → Domains: make sure your own domain is the primary domain and the others are set to redirect to it. Shopify then forwards in one step.",
      "Online Store → Navigation → \"URL Redirects\": find redirects that point to another redirected address and change them to go straight to the final page.",
      "Update menu links (Online Store → Navigation) and links in your text to the final address.",
    ],
    wix: [
      "Dashboard → Settings → Domains: make sure your own domain is the primary one.",
      "Dashboard → \"Marketing & SEO\" → \"SEO Tools\" → \"URL Redirect Manager\": change any redirect that points to another redirected address so it goes straight to the final page.",
      "Update menu and button links to the final address. Click Publish.",
    ],
    webflow: [
      "Site settings → \"Publishing\" (older: \"Hosting\"): make sure your main domain is set as the default, so the other version forwards straight to it.",
      "In the \"301 redirects\" list, change any rule whose target is itself redirected so it points to the final page.",
      "Update links in your Navbar, Footer and pages. Click Publish.",
    ],
    framer: [
      "Site settings → Domains: make sure your own domain is the primary one.",
      "Site settings → \"Redirects\": change any rule pointing to another redirected address so it goes straight to the final page.",
      "Update links in your navigation and pages. Click Publish.",
    ],
    squarespace: [
      "Settings → Domains: make sure your own domain is set as primary.",
      "Settings → Developer Tools → \"URL Mappings\": change any line pointing to another redirected address so it goes straight to the final page.",
      "Update links in your navigation and pages. Click Save.",
    ],
    custom: [
      "Pick one final form of your address (https, with or without www, with or without a slash at the end).",
      "Make every old address forward to its final address in one permanent (301) redirect — not through several steps.",
      "Update links in your menus and content to the final address.",
      "Send this to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs: "Collapse redirect chains: configure the primary domain at the host (one hop from apex/www and http), make next.config redirects() targets final URLs, align `trailingSlash` with internal links, and update internal links to final URLs.",
    react: "Collapse chains at the host level (domain primary + single 301), fix vercel.json/_redirects rules whose targets redirect again, and update internal links to final URLs.",
    custom: "Collapse redirect chains into single 301s (http→https, host canonicalisation and trailing slash in one rule), and update internal links to final URLs.",
  },
  verify: [
    "Type the old address (e.g. http://yourdomain.com/page) into a redirect checker such as httpstatus.io — it should show only one hop to the final page.",
    CHECK_AGAIN,
  ],
  time: "15–30 minutes",
  category: "technical",
};

// ---------------------------------------------------------------- Page list for Google (sitemap)

export const sitemapGuide: FixGuide = {
  effect: () =>
    "Google has no list of your pages, so new or hard-to-reach pages can take longer to show up — or be missed.",
  steps: {
    nextjs: [
      "Create a file `app/sitemap.ts` that lists your pages: `export default function sitemap(): MetadataRoute.Sitemap { return [{ url: \"https://www.yourdomain.com\", lastModified: new Date() }, …] }` (import `MetadataRoute` from `next`).",
      "For pages made from data (blog posts, products), load them in that file (make it `async`) and add one entry per item.",
      "Create `app/robots.ts` that returns `{ rules: { userAgent: \"*\", allow: \"/\" }, sitemap: \"https://www.yourdomain.com/sitemap.xml\" }`.",
      "Using the older `pages` folder? Install `next-sitemap` and follow its setup.",
      "Deploy and open `yourdomain.com/sitemap.xml` — you should see your pages.",
      "Submit it in Google Search Console (free): Sitemaps → type `sitemap.xml` → Submit.",
    ],
    react: [
      "React doesn't make this list for you. Add a tool that writes `sitemap.xml` when the site is built — e.g. `vite-plugin-sitemap` for Vite — or keep a hand-written `public/sitemap.xml` with one line per page.",
      "Add the line `Sitemap: https://www.yourdomain.com/sitemap.xml` to `public/robots.txt`.",
      "Check your host doesn't send `/sitemap.xml` to `index.html` (single-page fallback rules) — the address must show the list, not your home page.",
      "Deploy and open `yourdomain.com/sitemap.xml`.",
      "Submit it in Google Search Console: Sitemaps → type `sitemap.xml` → Submit.",
    ],
    wordpress: [
      "WordPress makes a list itself at `yourdomain.com/wp-sitemap.xml`, unless something switched it off. With Yoast it's at `/sitemap_index.xml`.",
      "Yoast: Yoast → Settings → \"Site features\" → switch on \"XML sitemaps\". Rank Math: Rank Math → Dashboard → switch on the \"Sitemap\" module.",
      "If the list still doesn't open, check Settings → Reading → \"Search engine visibility\" is unticked — when ticked, WordPress hides the list.",
      "Open the address in your browser to check it lists your pages.",
      "Submit it in Google Search Console (free): Sitemaps → paste the address → Submit.",
    ],
    shopify: [
      "Shopify makes this list automatically at `yourdomain.com/sitemap.xml` — there's nothing to build.",
      "If we couldn't find it, your store may be password protected: Online Store → Preferences → \"Password protection\" → untick \"Restrict access…\" (paid plan needed).",
      "Open `yourdomain.com/sitemap.xml` in your browser to check it loads.",
      "Submit it in Google Search Console (free): Sitemaps → type `sitemap.xml` → Submit. Shopify's guide \"Submitting your sitemap\" shows the steps.",
    ],
    wix: [
      "Wix makes this list automatically at `yourdomain.com/sitemap.xml` once your site is published on your own domain.",
      "If we couldn't find it: make sure the site is published and connected to your domain (Dashboard → Settings → Domains).",
      "Pages hidden from search are left out — check \"SEO basics\" on important pages.",
      "Connect Google Search Console from Dashboard → \"Marketing & SEO\" → \"SEO\" (the setup checklist) — Wix submits the list for you.",
    ],
    webflow: [
      "Open Site settings → \"SEO\" tab.",
      "Switch on \"Auto-generate sitemap\" → Save changes.",
      "Publish the site, then open `yourdomain.com/sitemap.xml` to check it.",
      "Submit it in Google Search Console (free): Sitemaps → type `sitemap.xml` → Submit.",
    ],
    framer: [
      "Framer makes this list automatically at `yourdomain.com/sitemap.xml` once the site is published.",
      "If we couldn't find it: make sure the site is published to your own domain (Site settings → Domains).",
      "Open the address to check it lists your pages.",
      "Submit it in Google Search Console (free): Sitemaps → type `sitemap.xml` → Submit.",
    ],
    squarespace: [
      "Squarespace makes this list automatically at `yourdomain.com/sitemap.xml`.",
      "If we couldn't find it, your site may be private: Settings → \"Site availability\" → \"Public\".",
      "Open the address to check it lists your pages.",
      "Submit it in Google Search Console (free): Sitemaps → type `sitemap.xml` → Submit. You can connect Search Console from Squarespace's Analytics panel.",
    ],
    custom: [
      "Create a file `sitemap.xml` at the root of your site listing every public page address (your developer or a sitemap generator tool can make it).",
      "Add the line `Sitemap: https://www.yourdomain.com/sitemap.xml` to your `robots.txt` file.",
      "Open `yourdomain.com/sitemap.xml` to check it loads.",
      "Submit it in Google Search Console (free): Sitemaps → type `sitemap.xml` → Submit.",
    ],
  },
  promptHints: {
    nextjs: "Add app/sitemap.ts (MetadataRoute.Sitemap) including static routes and dynamic entries fetched from the data source, and app/robots.ts referencing the absolute sitemap URL. Use absolute https URLs on the primary host. For pages/ router, use next-sitemap in postbuild.",
    react: "Generate sitemap.xml at build time (vite-plugin-sitemap or a small Node script over the route list) into public/, reference it from public/robots.txt, and exclude /sitemap.xml and /robots.txt from SPA fallback rewrites.",
    custom: "Generate an XML sitemap of all public canonical URLs (absolute, https, primary host), serve it at /sitemap.xml, and reference it in robots.txt.",
  },
  verify: [
    "Open yourdomain.com/sitemap.xml (or the address above) — you should see a list of your pages.",
    "In Google Search Console → Sitemaps, the status should say \"Success\" after a day or two.",
    CHECK_AGAIN,
  ],
  time: "15–30 minutes",
  category: "technical",
};

// ---------------------------------------------------------------- Secure connection (HTTPS)

export const httpsGuide: FixGuide = {
  effect: (ctx) =>
    ctx.issue.title.includes("isn't secure")
      ? "Browsers show \"Not secure\" next to your website, which puts visitors off — and Google prefers secure sites."
      : "Some visitors can still land on an unsecured version of your site, where browsers show \"Not secure\" — and Google may treat the two versions as different sites.",
  steps: {
    nextjs: [
      "If your site is on Vercel or Netlify, the padlock (HTTPS) is free and switched on automatically for domains added to the project — check Project → Settings → Domains shows your domain as valid.",
      "If the domain shows an error, fix the DNS records your host lists (at the company where you bought the domain).",
      "On your own server, ask your developer to install a free Let's Encrypt certificate (e.g. with Caddy, or Nginx + certbot) and forward all http:// to https://.",
      "Search your code for `http://` (images, scripts, fonts, `metadataBase`) and change them to `https://` — mixed addresses remove the padlock.",
      "Deploy and open `http://yourdomain.com` — it should switch to `https://` with a padlock.",
    ],
    react: [
      "On Vercel, Netlify or Cloudflare Pages the padlock is free and automatic — check your domain settings show the certificate as active (Netlify: Domain management → HTTPS).",
      "If it isn't, fix the DNS records your host lists at the company where you bought the domain.",
      "On your own server, ask your developer to install a free Let's Encrypt certificate and forward all http:// to https://.",
      "Search your code and `index.html` for `http://` addresses and change them to `https://`.",
      "Deploy and open `http://yourdomain.com` — it should switch to `https://` with a padlock.",
    ],
    wordpress: [
      "Log in to your hosting control panel and switch on the free certificate (often called \"SSL\", \"Let's Encrypt\" or \"AutoSSL\" — in cPanel: \"SSL/TLS Status\"). Your host's support can do it for you in minutes.",
      "In WordPress: Settings → General → change \"WordPress Address\" and \"Site Address\" to start with `https://` → Save. (You'll be logged out — log back in.)",
      "Install the \"Really Simple Security\" plugin (formerly Really Simple SSL) and activate it — it forwards every visitor to the secure version.",
      "Fix old http:// links and images: install \"Better Search Replace\" → Tools → Better Search Replace → replace `http://yourdomain.com` with `https://yourdomain.com`.",
      "Open `http://yourdomain.com` — it should switch to the padlock version.",
    ],
    shopify: [
      "Shopify gives every domain a free certificate automatically and always sends visitors to the secure version.",
      "Check Settings → Domains: each domain should show \"SSL certificate\" as active/issued. If it's pending, your domain's DNS isn't pointing at Shopify yet.",
      "To fix pending: at your domain provider, the A record should be `23.227.38.65` and the www CNAME `shops.myshopify.com` (Shopify shows the exact values). Certificates usually arrive within 48 hours.",
      "If the padlock is missing on some pages, look for images or embeds in your text added with `http://` addresses and re-add them.",
    ],
    wix: [
      "Wix switches on the padlock for every site automatically — you shouldn't need to do anything.",
      "Check Dashboard → Settings → Domains: your domain should be connected without warnings. If it shows a DNS problem, follow Wix's steps to point the domain at Wix.",
      "If some pages lose the padlock, look for \"Embed HTML\" boxes or images that load from `http://` addresses and change them to `https://`.",
      "Click Publish.",
    ],
    webflow: [
      "Open Site settings → \"Publishing\" (older: \"Hosting\") → \"Advanced publishing options\".",
      "Make sure \"Enable SSL\" is switched on, then Save and Publish.",
      "Check your custom domain shows no DNS warnings on the same page — fix the records at your domain provider if it does.",
      "Look for custom code or embeds loading from `http://` addresses and change them to `https://`.",
    ],
    framer: [
      "Framer switches on the padlock automatically for connected domains.",
      "Check Site settings → Domains: your domain should be connected without warnings. If not, update the DNS records Framer shows at your domain provider.",
      "Look for custom code or embeds loading from `http://` addresses and change them to `https://`.",
      "Publish again.",
    ],
    squarespace: [
      "Go to Settings → \"SSL\" (in some versions Settings → Website → \"SSL\" or Settings → Advanced → \"SSL\").",
      "Choose \"Secure (preferred)\" and switch on \"HSTS Secure\" → Save.",
      "Check Settings → Domains shows your domain connected without warnings.",
      "Look for code blocks or images loading from `http://` addresses and change them to `https://`.",
    ],
    custom: [
      "Install a free certificate (Let's Encrypt) on your server — most hosts have a one-click option.",
      "Forward every `http://` address to the same `https://` address with a permanent (301) redirect.",
      "Change any `http://` links to images, scripts and fonts to `https://`.",
      "Send this to your web developer or host's support.",
    ],
  },
  promptHints: {
    nextjs: "Ensure the deployment serves HTTPS with http→https 301/308 redirects (Vercel/Netlify do this automatically for verified domains; self-hosted: Caddy or Nginx+certbot). Replace hard-coded http:// asset/API URLs and metadataBase with https://. Optionally add a Strict-Transport-Security header in next.config headers().",
    react: "Ensure the host serves HTTPS with http→https redirects; replace http:// URLs in code and index.html with https://; optionally add HSTS via host headers config.",
    custom: "Install a TLS certificate (Let's Encrypt), 301-redirect all http:// URLs to https://, fix mixed-content references, and consider HSTS.",
  },
  verify: [
    "Type http://yourdomain.com (without the s) into your browser — it should switch to https:// and show a padlock.",
    "Click the padlock — it should say the connection is secure.",
    CHECK_AGAIN,
  ],
  time: "15–30 minutes (certificates can take up to a day to arrive)",
  category: "technical",
};

// ---------------------------------------------------------------- Mobile-friendly setup (viewport)

export const mobileViewportGuide: FixGuide = {
  effect: (ctx) =>
    `${count(affected(ctx), "page")} ${affected(ctx) === 1 ? "is" : "are"} missing the phone setting, so phones may show a tiny, zoomed-out desktop page — and Google judges your site by how it works on a phone.`,
  steps: {
    nextjs: [
      "With the `app` folder, Next.js adds the phone setting to every page by itself. If it's missing, something overrides it.",
      "Open `app/layout.tsx`: remove any hand-written `<meta name=\"viewport\">` inside a `<head>` tag, and any `viewport` inside `metadata`.",
      "If you need a custom setting, use `export const viewport = { width: \"device-width\", initialScale: 1 }` in `app/layout.tsx`.",
      "Using the older `pages` folder? Add `<Head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" /></Head>` in `pages/_app.tsx` (not in `_document`).",
      "Deploy and view the source (Ctrl+U): search for `viewport`.",
    ],
    react: [
      "Open `index.html` in your project root (Vite) or `public/index.html` (Create React App).",
      "Inside `<head>`, add `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />` if it's missing.",
      "Deploy and open the site on your phone — it should fit the screen without zooming.",
    ],
    wordpress: [
      "Modern themes include the phone setting. If yours doesn't, your theme is probably old — the best fix is to switch to an up-to-date theme (Appearance → Themes → Add New), after testing it.",
      "Quick fix: install the \"WPCode\" plugin → Code Snippets → \"Header & Footer\" → paste `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">` into the Header box → Save.",
      "Then check the pages on your phone — an old theme may still not adapt its layout to small screens.",
    ],
    shopify: [
      "Themes from the Shopify Theme Store include the phone setting. If it's missing, your theme is old or was edited.",
      "Online Store → Themes → ⋯ → Edit code → open `layout/theme.liquid`.",
      "Inside `<head>`, add `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">` if it's missing → Save. (Or ask a Shopify expert.)",
      "Better long term: switch to a current free theme like Dawn (Online Store → Themes → Add theme).",
    ],
    wix: [
      "Wix adds the phone setting itself, so this is unusual on Wix.",
      "In the Editor, switch to mobile view (phone icon at the top) and check your pages look right there.",
      "If the problem stays after you Publish, contact Wix Support with this report — it may come from custom code (Settings → \"Custom Code\") that you can remove.",
    ],
    webflow: [
      "Webflow adds the phone setting itself, so this usually comes from custom code.",
      "Check Site settings → \"Custom code\" → \"Head code\", and each page's settings → \"Custom code\", for another `viewport` line — remove it.",
      "Use the phone view buttons at the top of the Designer to check your layout on small screens.",
      "Click Publish.",
    ],
    framer: [
      "Framer adds the phone setting itself, so this usually comes from custom code.",
      "Check Site settings → General → \"Custom Code\" for another `viewport` line and remove it.",
      "Make sure you've set up the phone layout (add a Phone breakpoint on each page) and Publish.",
    ],
    squarespace: [
      "Squarespace adds the phone setting itself.",
      "Check Settings → Developer Tools → \"Code Injection\" → Header for another `viewport` line and remove it.",
      "Preview your site in phone view (the phone icon in the editor) and Save.",
    ],
    custom: [
      "Add `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">` inside `<head>` on every page (usually once, in the shared template).",
      "Make sure your design adapts to small screens (responsive layout).",
      "Send this to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs: "App Router injects a default viewport meta; ensure nothing overrides it (manual <meta name=viewport> in layout <head>, deprecated `metadata.viewport`). Use `export const viewport: Viewport = { width: 'device-width', initialScale: 1 }` if customising. pages/ router: put the viewport meta in _app via next/head, not _document.",
    react: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" /> to index.html <head>.",
    custom: "Add the viewport meta tag (width=device-width, initial-scale=1) to the shared <head> template of every page.",
  },
  verify: [
    "Open the pages on your phone — they should fit the screen without pinching or zooming.",
    "View the source (Ctrl+U) and search for viewport — it should say width=device-width.",
    CHECK_AGAIN,
  ],
  time: "About 15 minutes",
  category: "technical",
};

// ---------------------------------------------------------------- Page size (speed estimate)

export const pageSpeedGuide: FixGuide = {
  effect: (ctx) =>
    `${count(affected(ctx), "page")} ${affected(ctx) === 1 ? "is" : "are"} heavy or load several scripts before showing anything, so ${affected(ctx) === 1 ? "it" : "they"} may open slowly — especially on phones. (This is an estimate, not a full speed test.)`,
  changes: (ctx) =>
    ctx.pages.map((p) => ({
      page: pageName(p.url),
      now: p.note ?? "Heavy page or several scripts loading first",
      change: "Test it in PageSpeed Insights, then remove unused scripts/apps and shrink big pictures.",
    })),
  steps: {
    nextjs: [
      "Test the pages from the list at pagespeed.web.dev to see what slows them down.",
      "Very large pages often send big data to the browser: don't pass whole lists or database records into `\"use client\"` components — pass only the fields they show.",
      "Load extra scripts (chat widgets, analytics, ads) with `next/script` and `strategy=\"afterInteractive\"` or `\"lazyOnload\"` instead of plain `<script>` tags in `<head>`.",
      "Use `next/image` for pictures, and don't paste big SVGs or pictures as text (`data:` addresses) into components.",
      "Run `@next/bundle-analyzer` to find large libraries, and load rarely used parts with `next/dynamic`.",
      "Deploy and test again in PageSpeed Insights.",
    ],
    react: [
      "Test the pages at pagespeed.web.dev to see what slows them down.",
      "In `index.html`, move third-party `<script>` tags to the end of `<body>` or add `defer` / `async` so they don't block the page.",
      "Split your app so each page loads only its own code: `React.lazy(() => import(\"./pages/Services\"))` with `<Suspense>`.",
      "Shrink pictures (WebP, right size) and remove libraries you don't use.",
      "Deploy and test again.",
    ],
    wordpress: [
      "Test the pages at pagespeed.web.dev to see what slows them down.",
      "Plugins → Installed Plugins: deactivate and delete plugins you don't use — each one can add scripts to every page.",
      "Install a speed plugin: \"LiteSpeed Cache\" (if your host uses LiteSpeed), \"WP Rocket\" (paid) or \"W3 Total Cache\". Switch on page caching and \"delay\"/\"defer\" JavaScript.",
      "Shrink images with a plugin like \"ShortPixel\" or \"Smush\" (convert to WebP).",
      "Heavy page builders and sliders slow pages down — simplify the pages in the list.",
      "Test again in PageSpeed Insights.",
    ],
    shopify: [
      "Test the pages at pagespeed.web.dev, and check Shopify's report: Analytics → Reports → \"Web performance\" (or Online Store → Themes → speed).",
      "Apps → uninstall apps you don't use. Some leave code behind — check Online Store → Themes → ⋯ → Edit code for leftover app snippets, or ask the app's support to remove them.",
      "Online Store → Themes → Customize: remove sections you don't need on the home page (big slideshows, videos, many product grids).",
      "Upload pictures no larger than needed (about 2000 px wide for banners).",
      "Test again.",
    ],
    wix: [
      "Check Dashboard → Analytics → \"Site Speed\" and test the pages at pagespeed.web.dev.",
      "Remove apps you don't use (Dashboard → Apps → Manage Apps).",
      "On the pages in the list, cut down on heavy items: video backgrounds, big galleries, many animations and \"Embed HTML\" boxes.",
      "Keep the most important content near the top of the page. Click Publish and test again.",
    ],
    webflow: [
      "Test the pages at pagespeed.web.dev.",
      "Site settings → \"Publishing\" (older: \"Hosting\") → \"Advanced publishing options\": switch on minifying HTML, CSS and JS.",
      "Assets panel: compress images (convert to WebP/AVIF) and set large images to lazy load.",
      "Check Site settings → \"Custom code\" and page custom code for scripts you no longer need, and remove them. Reduce heavy interactions.",
      "Publish and test again.",
    ],
    framer: [
      "Test the pages at pagespeed.web.dev.",
      "Check Site settings → General → \"Custom Code\" for scripts you no longer need and remove them.",
      "Use fewer heavy effects, videos and embeds on the pages in the list, and upload smaller pictures.",
      "Publish and test again.",
    ],
    squarespace: [
      "Test the pages at pagespeed.web.dev.",
      "Settings → Developer Tools → \"Code Injection\": remove scripts you no longer use.",
      "Shrink pictures before uploading (about 2500 px wide, under 500 KB) and use fewer video backgrounds and large galleries.",
      "Save and test again.",
    ],
    custom: [
      "Test the pages at pagespeed.web.dev to see what slows them down.",
      "Load extra scripts with `defer` or `async`, or at the end of the page, so they don't block it.",
      "Make large pages smaller: remove unused code, shrink images, don't put big data inside the HTML.",
      "Send this to your web developer, or paste the AI prompt below into an AI coding assistant.",
    ],
  },
  promptHints: {
    nextjs: "Reduce HTML/RSC payload: avoid passing large props to client components, avoid inline base64/SVG blobs, paginate long lists. Move third-party scripts to next/script with afterInteractive/lazyOnload. Use next/image. Analyse bundles with @next/bundle-analyzer and lazy-load heavy client components with next/dynamic.",
    react: "Add defer/async to blocking scripts in index.html, code-split routes with React.lazy/Suspense, optimise images, remove unused dependencies; check with Lighthouse.",
    custom: "Reduce HTML size (>500 KB flagged), defer/async render-blocking scripts in <head> (more than 3 flagged), optimise images, and remove unused third-party scripts.",
  },
  verify: [
    "Test the pages again at pagespeed.web.dev — the mobile score should go up.",
    CHECK_AGAIN,
  ],
  time: "1–2 hours",
  category: "technical",
};
