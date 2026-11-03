// Shared building blocks for the AI / answer / business-info fix guides: how to open, edit and publish a page on
// each platform, and where to paste "info for Google and AI" code. Guides compose these so every platform gets
// real, specific steps without repeating the same sentence 25 times.
import { PLATFORMS, type Platform } from "@/lib/platform/detect";
import type { FixGuide, FixPage } from "../../types";

export type Steps = FixGuide["steps"];

/** Build steps for every platform from one function (guarantees all 9 keys exist). */
export function perPlatform(fn: (p: Platform) => string[]): Steps {
  const out = {} as Record<Platform, string[]>;
  for (const p of PLATFORMS) out[p] = fn(p);
  return out;
}

/** The same steps on every platform (for work that happens outside the website). */
export function everywhere(steps: string[]): Steps {
  return perPlatform(() => steps);
}

/** How to open one page's text for editing. */
export const OPEN_PAGE: Record<Platform, string> = {
  nextjs:
    "Open the page's file in your project, e.g. `app/services/page.tsx` for /services. If the words come from a content system (Sanity, Contentful, a headless WordPress, or Markdown files in a `content` folder), edit them there instead.",
  react:
    "Open the component for the page, usually in `src/pages/` or `src/routes/` (or the content system that feeds it).",
  wordpress: "Log in to WordPress (yoursite.com/wp-admin), go to Pages (or Posts) and click Edit on the page from the list.",
  shopify:
    "In your Shopify admin go to Online Store → Pages (or Products / Blog posts) and open the page. For the home page use Online Store → Themes → Customize.",
  wix: "Open the Wix Editor, click Pages & Menu on the left and choose the page from the list.",
  webflow: "Open the Webflow Designer and pick the page in the Pages panel. Blog posts and other CMS items are edited in the CMS panel.",
  framer: "Open your project in Framer and select the page in the Pages panel. Blog posts and other CMS items are edited in the CMS panel.",
  squarespace: "In Squarespace go to Pages, open the page and click Edit at the top left.",
  custom: "Open the page's HTML file or template (or send this list to whoever builds your site).",
};

/** How to make a line into a subheading (Heading 2). */
export const MAKE_HEADING: Record<Platform, string> = {
  nextjs: "Write each question as an `<h2>` (or `<h3>` under a section) and put the answer in a `<p>` straight after it — no other element in between.",
  react: "Write each question as an `<h2>` (or `<h3>`) and put the answer in a `<p>` straight after it.",
  wordpress: "Click the + button → Heading, and choose H2 in the small toolbar. Press Enter and type the answer as a normal paragraph.",
  shopify: "Type the question on its own line, select it and choose Heading 2 from the formatting menu (the \"A\" / Paragraph menu) in the editor toolbar.",
  wix: "Click + Add Elements → Text → pick a Heading 2 style (or click existing text and choose \"Heading 2\" in the text settings). Add a paragraph text box under it for the answer.",
  webflow: "Add a Heading element (Add panel → Typography → Heading) and set it to H2 in the element settings. Inside a CMS rich-text field, select the line and choose H2.",
  framer: "Add a text layer, and in the Text section on the right set the Tag to H2. Put the answer in a normal text layer right under it.",
  squarespace: "In a text block, select the question and choose Heading 2 from the text format menu. Type the answer as a normal paragraph under it.",
  custom: "Use an `<h2>` (or `<h3>`) tag for each question and a `<p>` paragraph straight after it for the answer.",
};

/** How to add a bullet / numbered list or a table. */
export const MAKE_LIST: Record<Platform, string> = {
  nextjs: "Use `<ul>`/`<li>` for bullet points, `<ol>`/`<li>` for numbered steps and a real `<table>` (with `<th>` header cells) for prices or comparisons — not rows of `div`s.",
  react: "Use `<ul>`/`<li>` for bullet points, `<ol>`/`<li>` for numbered steps and a real `<table>` (with `<th>` header cells) for prices or comparisons — not rows of `div`s.",
  wordpress: "Click + → List for bullets (switch to numbers in the toolbar), and + → Table for prices or comparisons.",
  shopify: "Use the bullet-list and numbered-list buttons in the page editor toolbar. For a table, click the table icon (or, if your editor has none, click Show HTML (`<>`) and ask the AI prompt below for a simple table you can paste).",
  wix: "Select a text box and click the bullet or numbered-list button in the text settings. For a price table, use + Add Elements → Table (or the Wix Table Master app).",
  webflow: "Add a List element (Add panel → Typography → List), or use the list buttons inside a CMS rich-text field. For tables, add an Embed element with a simple HTML `<table>`.",
  framer: "Type the items in a text layer and use the list button in the Text section (bullets or numbers). For a table, use a Table component from Insert → Components, or an Embed with a simple HTML `<table>`.",
  squarespace: "In a text block, select the lines and click the bullet or numbered-list button. For a table, add a Code block with a simple HTML `<table>` (or a Markdown block).",
  custom: "Use `<ul>`/`<ol>` with `<li>` for lists and a real `<table>` with `<th>` header cells for prices or comparisons.",
};

/** How to save and publish. */
export const PUBLISH: Record<Platform, string> = {
  nextjs: "Save, commit and deploy (for example push to GitHub so Vercel rebuilds the site).",
  react: "Save, build and deploy the site.",
  wordpress: "Click Update (or Publish) at the top right.",
  shopify: "Click Save.",
  wix: "Click Publish at the top right.",
  webflow: "Click Publish and choose your live domain.",
  framer: "Click Publish at the top right.",
  squarespace: "Click Save, then Exit.",
  custom: "Upload or deploy the changed pages.",
};

/** How to create a new page. */
export const NEW_PAGE: Record<Platform, string> = {
  nextjs: "Create a new folder and file for each new page, e.g. `app/services/boiler-repair/page.tsx`, with its own `metadata` title and description, and link it from your menu or services page.",
  react: "Add a new route and component for each new page, and make sure it is pre-rendered so the text is in the page Google and AI robots download.",
  wordpress: "Go to Pages → Add New Page for each new page, then add it to your menu under Appearance → Menus (or Appearance → Editor → Navigation on block themes).",
  shopify: "Go to Online Store → Pages → Add page for each new page, then add it under Online Store → Navigation → Main menu.",
  wix: "In the Editor click Pages & Menu → + Add Page for each new page; it's added to your menu automatically (drag it where you want it).",
  webflow: "In the Pages panel click + (Create new page), or add a CMS item if your services are a CMS collection, and link it from your navigation.",
  framer: "In the Pages panel click + → New Page (or add a CMS item), and link it from your navigation.",
  squarespace: "Go to Pages → + → choose a blank page or layout for each new page; pages in the Main Navigation section appear in your menu.",
  custom: "Create a new page (HTML file or template) for each topic and link it from your menu.",
};

/** Where to paste a code block so it appears on EVERY page. */
export const PASTE_SITE_WIDE: Record<Platform, string[]> = {
  nextjs: [
    "Open `app/layout.tsx` (the shared layout every page uses). Keep this code in that server file — not in a component that starts with `\"use client\"`.",
    "Inside `<body>`, render `<script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, \"\\\\u003c\") }} />`, where `data` is an object with your details (the AI prompt below writes it for you).",
  ],
  react: [
    "Open `index.html` (in the project root for Vite, or `public/index.html` for Create React App).",
    "Paste the code inside `<head>`. Code in `index.html` is part of the raw page, so AI robots that don't run JavaScript still see it.",
  ],
  wordpress: [
    "Install the free plugin \"WPCode\" (Plugins → Add New Plugin → search \"WPCode\" → Install → Activate).",
    "Go to Code Snippets → + Add Snippet → Add Your Custom Code → choose \"HTML Snippet\", paste the code, set Location to \"Site Wide Header\", switch it to Active and click Save Snippet.",
  ],
  shopify: [
    "Go to Online Store → Themes, click ⋯ next to Customize → Edit code.",
    "Open `layout/theme.liquid`, paste the code on the line just above `</head>` and click Save.",
  ],
  wix: [
    "Go to your Wix dashboard → Settings → Custom Code (under Advanced). This needs a paid plan with a connected domain.",
    "Click + Add Custom Code, paste the code, choose \"All pages\" and \"Load code once\", set Place Code in to \"Head\", then click Apply.",
  ],
  webflow: [
    "Open Site settings → Custom code (needs a paid site plan).",
    "Paste the code into \"Head code\", click Save changes, then Publish.",
  ],
  framer: [
    "Open Site Settings (gear icon at the top) → General → Custom Code (may need a paid plan).",
    "Paste the code into \"End of <head> tag\" and click Publish.",
  ],
  squarespace: [
    "Go to Settings → Advanced → Code Injection (in newer dashboards: Settings → Developer tools → Code injection). Needs a Core / Business plan or higher.",
    "Paste the code into the Header box and click Save.",
  ],
  custom: ["Paste the code inside the `<head>` of your shared template or layout, so it appears on every page."],
};

/** Where to paste a code block on ONE page. */
export const PASTE_ONE_PAGE: Record<Platform, string> = {
  nextjs:
    "In that page's `page.tsx` (a server component, not `\"use client\"`), render `<script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, \"\\\\u003c\") }} />`, building `data` from the same content that is shown on the page.",
  react:
    "Add the code inside the page component (e.g. with react-helmet-async: `<Helmet><script type=\"application/ld+json\">{JSON.stringify(data)}</script></Helmet>`). Unless the page is pre-rendered, only Google (which runs JavaScript) will see it — pre-render to reach AI robots too.",
  wordpress:
    "Use WPCode (Code Snippets → + Add Snippet → HTML Snippet), set Location to \"Site Wide Header\" and under Smart Conditional Logic show it only on this page — or use your SEO plugin's per-page option (Rank Math: the `Schema` tab in the page's Rank Math panel).",
  shopify:
    "Go to Online Store → Themes → Customize, pick the page's template at the top, click Add section → Custom Liquid, paste the code and Save. If other pages share that template, first give this page its own template (Edit code → templates → Add a new template).",
  wix: "Click Pages & Menu, hover the page → ⋯ → SEO basics → Advanced SEO tab → Structured data markup → + Add New Markup, paste the code and click Apply.",
  webflow: "In the Pages panel hover the page → gear icon (Page settings) → Custom code → \"Inside <head> tag\", paste the code, Save, then Publish. For CMS template pages you can insert fields (+ Add Field) into the code.",
  framer: "In the Pages panel open the page's settings → Custom Code → \"End of <head> tag\", paste the code and Publish.",
  squarespace: "Go to Pages, click the gear icon next to the page → Advanced → Page Header Code Injection, paste the code and Save.",
  custom: "Paste the code inside that page's `<head>` (or just before `</body>`).",
};

/** A fill-in-the-blanks business-info block (Organization). `<Brand>` is replaced with the business name. */
export const ORG_CODE =
  "`<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Organization\",\"name\":\"<Brand>\",\"url\":\"YOUR WEBSITE ADDRESS\",\"logo\":\"LINK TO YOUR LOGO IMAGE\",\"sameAs\":[\"LINK TO YOUR LINKEDIN PAGE\",\"LINK TO YOUR FACEBOOK PAGE\"]}</script>`";

export const CHECK_CODE =
  "Check it: open Google's Rich Results Test (search.google.com/test/rich-results), enter the page address and make sure it shows your info with no errors. `validator.schema.org` checks it too.";

/** Words of main text on a page (body copy if we measured it). */
export const wordsOf = (p: FixPage) => p.extracted?.contentWordCount ?? p.extracted?.wordCount ?? 0;

/** Topic for use inside a sentence ("Boiler Repair" → "boiler repair"); keeps acronyms like "SEO" or "HVAC". */
export const lower = (s: string) =>
  s
    .split(" ")
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase()))
    .join(" ");

/** How to add a new block of text (a section) to an existing page. */
export const ADD_SECTION: Record<Platform, string> = {
  nextjs: "Add the new sections as real text in the page component (headings, paragraphs, lists) — not inside images, and not only in components that load their text in the browser.",
  react: "Add the new sections as real text in the page component, and make sure the page is pre-rendered so the text is in the page robots download.",
  wordpress: "Click + to add Heading and Paragraph blocks. On Elementor or Divi, add a Text Editor / Text module in a new section.",
  shopify: "Home page: Online Store → Themes → Customize → Add section → Rich text, Multicolumn or Collapsible content. Other pages: type into the page's Content box.",
  wix: "Hover between two sections and click + Add Section, choose a text layout, then type your words.",
  webflow: "Drag a Section from the Add panel, then add Heading and Paragraph (or Rich Text) elements inside it.",
  framer: "Insert a new section (Insert → Sections, or duplicate an existing text section) and replace its text.",
  squarespace: "Hover between sections → Add Section (choose a text layout), or click + inside a section and add a Text block.",
  custom: "Add the new sections as real HTML text (headings, paragraphs, lists) in the page template.",
};

/** How to turn some words into a link. */
export const ADD_LINK: Record<Platform, string> = {
  nextjs: "Write the link as `<a href=\"https://source-address\">name of the source</a>` (or in your content system's editor).",
  react: "Write the link as `<a href=\"https://source-address\">name of the source</a>`.",
  wordpress: "Select the words, click the link icon (or press Ctrl+K), paste the source's address and press Enter.",
  shopify: "Select the words, click the Insert link icon in the editor toolbar, paste the address and click Insert link.",
  wix: "Select the words, click the Link icon in the text settings → Web address, paste the address and click Done.",
  webflow: "Select the words, click the link icon that appears, paste the address and press Enter.",
  framer: "Select the words and add a Link in the Text section on the right, then paste the address.",
  squarespace: "Select the words in the text block, click the link icon, paste the address and click Apply.",
  custom: "Write the link as `<a href=\"https://source-address\">name of the source</a>`.",
};

/** How to add a link to `href` in the footer (shown on every page). */
export function footerLink(p: Platform, href: string): string {
  const map: Record<Platform, string> = {
    nextjs: `Link it from your shared footer component (often \`components/footer.tsx\`, used in \`app/layout.tsx\`) with \`<Link href="${href}">\` so it appears on every page.`,
    react: `Link it from your shared footer component with \`<a href="${href}">\` so it appears on every page.`,
    wordpress: "Link it from the footer: block themes → Appearance → Editor → Patterns → Footer (add a link in the Navigation or Paragraph block); classic themes → Appearance → Menus → choose the footer menu → add the page → Save Menu.",
    shopify: "Link it from the footer: Online Store → Navigation → Footer menu → Add menu item, pick the page and click Save.",
    wix: "Link it from the footer: in the Editor click your footer (shared by every page), add or edit a text link and point it to the page.",
    webflow: "Link it from the footer: open your footer Symbol / Component (shared by every page) and add a Text Link to the page.",
    framer: "Link it from the footer: open your footer component (shared by every page) and add a text link to the page.",
    squarespace: "Link it from the footer: click Edit → Edit Footer, add a Text block with a link to the page and Save.",
    custom: `Link it from the shared footer template (\`<a href="${href}">\`) so it appears on every page.`,
  };
  return map[p];
}

/** Where the robot rules file lives (one line, used by AI-result guides). */
export const ROBOT_RULES_WHERE: Record<Platform, string> = {
  nextjs: "Your robot rules file comes from `app/robots.ts` (or `public/robots.txt`) — make sure it doesn't block OAI-SearchBot, ChatGPT-User, PerplexityBot or Claude-SearchBot.",
  react: "Your robot rules file is `public/robots.txt` — make sure it doesn't block OAI-SearchBot, ChatGPT-User, PerplexityBot or Claude-SearchBot.",
  wordpress: "Check your robot rules file in Yoast SEO → Tools → File editor (or Rank Math → General Settings) doesn't block the AI search robots, and that Settings → Reading → \"Discourage search engines\" is unticked.",
  shopify: "Shopify's standard robot rules let AI search robots in; if you edited them, check Online Store → Themes → Edit code → `robots.txt.liquid`.",
  wix: "Check Marketing & SEO → SEO → Tools and settings → robot rules editor doesn't block the AI search robots.",
  webflow: "Check Site settings → SEO → Indexing: the robot rules box shouldn't block the AI search robots.",
  framer: "Framer manages your robot rules file; make sure search indexing is on in Site Settings and no service in front of your site (like Cloudflare) blocks AI robots.",
  squarespace: "Check Settings → Crawlers: \"Block known artificial intelligence crawlers\" should be off if you want to appear in AI answers.",
  custom: "Make sure your robot rules file doesn't block OAI-SearchBot, ChatGPT-User, PerplexityBot or Claude-SearchBot, and that services like Cloudflare don't block AI robots either.",
};
