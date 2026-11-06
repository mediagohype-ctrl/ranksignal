// "Brand" website guides (brand.*): business name, business info + logo, About, contact details,
// privacy policy and social profile links.
import type { Platform } from "@/lib/platform/detect";
import type { FixGuide } from "../../types";
import { clip, isHome, pageName, suggestTitle } from "../../helpers";
import { NEW_PAGE, PUBLISH, footerLink, perPlatform } from "./shared";
import { orgSteps, ORG_HINTS } from "./org";

// ---------------------------------------------------------------------------------------------------------------

const NAME_IN_HEADLINES: Record<Platform, string> = {
  nextjs:
    "In `app/layout.tsx` set `export const metadata = { title: { default: \"<Brand> – what you do\", template: \"%s | <Brand>\" } }` so every page's Google headline ends with your name. Pages that set their own `title` then only need the topic part.",
  react:
    "Give every page a headline ending in your name — `<title>Page topic | <Brand></title>` via react-helmet-async (or a `<title>` tag in the component on React 19) — and pre-render the pages so robots see it.",
  wordpress:
    "Check Settings → General → Site Title is exactly \"<Brand>\". Then Yoast → Settings → Content types → Pages (and Posts) → SEO title: `%%title%% %%sep%% %%sitename%%` (Rank Math: Titles & Meta → Pages → `%title% %sep% %sitename%`).",
  shopify:
    "Check Settings → Store details → Store name is exactly \"<Brand>\". Then for each page in the list: open it → Search engine listing → Edit → Page title, and use the 'Change it to' column.",
  wix: "Go to Marketing & SEO → SEO → SEO Settings → Edit by page type → Main pages → Title tag, and make sure it includes the Site Name variable. Check Settings → Business Info → name is exactly \"<Brand>\".",
  webflow:
    "For each page in the list: Pages panel → gear icon → SEO settings → Title tag, using the 'Change it to' column. For CMS templates use `{Name} | <Brand>`.",
  framer: "For each page in the list: open its settings → Title, and use the 'Change it to' column (\"Page topic | <Brand>\").",
  squarespace:
    "Go to Marketing → SEO → Search appearance → Pages and set the format to `%p | %s`. Make sure your site title (Edit → header → Site title) is exactly \"<Brand>\".",
  custom: "Give every page a `<title>` that ends with \"| <Brand>\" — use the 'Change it to' column.",
};

export const nameConsistencyGuide: FixGuide = {
  effect: (ctx) =>
    `"${ctx.brand}" is missing from the Google headline on ${ctx.issue.affectedCount} of your pages, so Google and AI assistants find it harder to connect those pages to your business.`,
  changes: (ctx) =>
    ctx.pages.map((p) => ({
      page: pageName(p.url),
      now: p.extracted?.title ? clip(p.extracted.title, 70) : "(no headline)",
      change: suggestTitle(p, ctx.brand),
    })),
  steps: perPlatform((p) => [
    "Decide on one spelling of your business name — \"<Brand>\" — including spaces, capitals and whether you add \"Ltd\", \"LLC\" or similar. Use it everywhere.",
    NAME_IN_HEADLINES[p],
    "On your home page, make sure the main heading or the first sentence names <Brand>, e.g. \"<Brand> – [what you do] in [where]\".",
    "Use the same spelling in your logo's image description, footer and share preview.",
    "Outside your website, use exactly the same name on your Google Business Profile, social media profiles and directory listings.",
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "Ensure the brand name appears consistently: a title template in app/layout.tsx (`title: { default, template: \"%s | Brand\" }`), page titles that rely on it, the brand in the home page <h1> or first paragraph, openGraph.siteName in root metadata, and logo alt text. Use the exact brand spelling provided.",
    react: "Add the brand to every route's <title> ('Topic | Brand'), the home <h1>, og:site_name and logo alt; pre-render routes so crawlers see the titles.",
    custom: "Add the brand to every page's <title> ('Topic | Brand'), the home <h1> or first paragraph, og:site_name and logo alt text, with the exact spelling provided.",
  },
  verify: [
    "Open each page and look at the browser tab — the headline should end with your business name.",
    "Click \"Check website\" on Home. Your name should be found in most Google headlines.",
  ],
  time: "20–40 minutes",
  category: "onsite",
};

// ---------------------------------------------------------------------------------------------------------------

const LOGO_NAME =
  "Make sure the name in this info is exactly \"<Brand>\" and the logo is a direct link to an image file (PNG, JPG or SVG, square, at least 112×112 pixels) — not a link to a page.";

export const organizationSchemaGuide: FixGuide = {
  effect: (ctx) =>
    `Your website doesn't clearly state ${ctx.brand}'s official name, logo and website in the hidden info Google and AI assistants read, so they have to piece it together — and Google may show the wrong logo or name.`,
  changes: (ctx) => {
    const home = ctx.pages.find((p) => isHome(p.url)) ?? ctx.pages[0];
    const org = home?.extracted?.organization;
    if (!home) return [];
    const missing = !org ? ["name", "logo", "website"] : [!org.logo && "logo", !org.name && "name"].filter((x): x is string => !!x);
    return [
      {
        page: pageName(home.url),
        now: org ? `Business info for "${clip(org.name ?? "(no name)", 40)}", logo: ${org.logo ? "yes" : "missing"}` : "No business info",
        change: missing.length ? `Add ${missing.join(", ")}; name exactly "${ctx.brand}"` : `Use the name exactly "${ctx.brand}"`,
      },
    ];
  },
  steps: perPlatform((p) => orgSteps(p, LOGO_NAME)),
  promptHints: ORG_HINTS,
  verify: [
    "Open Google's Rich Results Test (search.google.com/test/rich-results) with your home page: it should show an Organization (or LocalBusiness) with your exact name and logo, and no errors.",
    "Click \"Check website\" on Home. This problem should disappear from your list.",
  ],
  time: "20–40 minutes",
  category: "technical",
};

// ---------------------------------------------------------------------------------------------------------------

export const aboutPageGuide: FixGuide = {
  effect: (ctx) =>
    `We couldn't find an About page, so customers can't see who's behind ${ctx.brand}, and Google and AI assistants miss basic facts: who you are, where you work and since when.`,
  steps: perPlatform((p) => [
    NEW_PAGE[p],
    "Call it \"About\" (or \"About us\") with the address /about.",
    "Start with one plain sentence: \"<Brand> is a [what you do] in [where], started in [year] by [name].\"",
    "Add the people: names, roles, photos and qualifications or memberships.",
    "Add facts: years in business, customers or jobs done, areas you serve, awards, and what makes you different — in sentences, not just pictures.",
    "End with how to reach you (phone, email, address or service area) and a link to your Contact page.",
    footerLink(p, "/about"),
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "Create app/about/page.tsx (server component) with metadata (title 'About | Brand', description), an <h1>, sections for story, team (names/roles/credentials), facts (founded, area served, numbers), and contact; add AboutPage JSON-LD referencing the Organization @id. Link it from the header/footer components. Use placeholders for unknown facts.",
    react: "Add an /about route with story, team, facts and contact sections; link it from the nav/footer; ensure it's pre-rendered. Use placeholders for unknown facts.",
    custom: "Create an /about page with story, team, facts and contact sections, linked from the main navigation or footer. Use placeholders for unknown facts.",
  },
  verify: [
    "Open your home page and click the About link in the menu or footer — the page should open.",
    "Click \"Check website\" on Home. This problem should disappear from your list.",
  ],
  time: "1–2 hours",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

const TAP_TO_CALL: Record<Platform, string> = {
  nextjs: "Make the phone number and email clickable: `<a href=\"tel:+441234567890\">01234 567890</a>` and `<a href=\"mailto:hello@yoursite.com\">hello@yoursite.com</a>` (use your own, with the country code and no spaces after `tel:`).",
  react: "Make the phone number and email clickable: `<a href=\"tel:+441234567890\">…</a>` and `<a href=\"mailto:hello@yoursite.com\">…</a>` (your own details, country code, no spaces).",
  wordpress: "Make the phone number clickable: select it → link icon → type `tel:` followed by your number with country code and no spaces (e.g. `tel:+441234567890`). Do the same for email with `mailto:`.",
  shopify: "Make the phone number clickable: select it → Insert link → type `tel:` and your number with country code, no spaces (e.g. `tel:+441234567890`). For email use `mailto:`.",
  wix: "Make the phone number clickable: select the text → Link → Phone Number, and enter your number. For email choose Link → Email.",
  webflow: "Make the phone number clickable: select it → link settings → Phone, and enter your number. For email choose the Email link type.",
  framer: "Make the phone number clickable: select the text → Link → type `tel:` and your number with country code (e.g. `tel:+441234567890`). For email use `mailto:`.",
  squarespace: "Make the phone number clickable: select it → link icon → choose Phone (or type `tel:+441234567890`). For email choose Email (`mailto:`).",
  custom: "Make the phone number and email clickable with `<a href=\"tel:+441234567890\">` and `<a href=\"mailto:hello@yoursite.com\">` (your own details).",
};

const ADDRESS_INFO: Record<Platform, string> = {
  nextjs: "Add the address and phone to your business info for Google and AI in `app/layout.tsx`: use `LocalBusiness` with `address: { \"@type\": \"PostalAddress\", streetAddress, addressLocality, postalCode, addressCountry }` and `telephone`.",
  react: "Add the address and phone to the business info in `index.html`: use `LocalBusiness` with an `address` (`PostalAddress`) and `telephone`.",
  wordpress: "Add the address to your business info for Google and AI: Rank Math → Titles & Meta → Local SEO (address, phone, opening hours), or the Yoast Local SEO add-on.",
  shopify: "Add the address in Settings → Store details too, and include `address` and `telephone` in your business info code (the AI prompt below can write it).",
  wix: "Add the address and phone in Settings → Business Info — Wix uses it for your business details.",
  webflow: "Add `address` and `telephone` to your business info code in Site settings → Custom code → Head code (the AI prompt below can write it).",
  framer: "Add `address` and `telephone` to your business info code in Site Settings → General → Custom Code (the AI prompt below can write it).",
  squarespace: "Add the address and phone in Settings → Business information — Squarespace adds them to your business info automatically.",
  custom: "Add `address` (a `PostalAddress`) and `telephone` to your `LocalBusiness` business info in the shared template.",
};

export const contactInfoGuide: FixGuide = {
  effect: (ctx) =>
    `${ctx.brand}'s contact details are hard to find. Clear details build trust, help you appear in local searches, and let AI assistants give people your correct phone number and address.`,
  changes: (ctx) => {
    const home = ctx.pages.find((p) => isHome(p.url)) ?? ctx.pages[0];
    if (!home) return [];
    return [{ page: pageName(home.url), now: ctx.issue.whatsWrong, change: "Contact page in the menu, tap-to-call phone and clickable email in the footer, address in your business info" }];
  },
  steps: perPlatform((p) => [
    NEW_PAGE[p] + " Call it \"Contact\" with the address /contact.",
    "On it show: business name, full address (or \"Serving [areas]\" if customers don't visit you), phone, email, opening hours and a simple form or map.",
    TAP_TO_CALL[p],
    "Put the phone number and email in your footer too, so they're on every page, and link your Contact page there. " + footerLink(p, "/contact"),
    "Write the name, address and phone exactly as they appear on your Google Business Profile — same spelling, same format.",
    ADDRESS_INFO[p],
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "Create/verify app/contact/page.tsx with name, address, phone (tel: link), email (mailto: link), hours, map/form; add phone and email links to the shared footer; add address (PostalAddress), telephone and openingHoursSpecification to the Organization/LocalBusiness JSON-LD in app/layout.tsx. Use placeholders for unknown details.",
    react: "Add a /contact route and footer tel:/mailto: links, plus LocalBusiness address/telephone in the JSON-LD in index.html. Pre-render the route.",
    custom: "Add a /contact page, tel:/mailto: links in the footer template, and LocalBusiness address/telephone JSON-LD in the shared <head>.",
  },
  verify: [
    "On your phone, open your site and tap the phone number — it should start a call.",
    "Check the Contact link is in your menu or footer, and the address matches your Google Business Profile exactly.",
    "Click \"Check website\" on Home. This problem should disappear from your list.",
  ],
  time: "30–45 minutes",
  category: "onsite",
};

// ---------------------------------------------------------------------------------------------------------------

const PRIVACY_WRITE: Record<Platform, string> = {
  nextjs: "Write the policy with a privacy policy generator (e.g. Termly, iubenda or your country's data-protection authority template) and save it as `app/privacy-policy/page.tsx` (or a Markdown page).",
  react: "Write the policy with a privacy policy generator (e.g. Termly or iubenda) and add it as a `/privacy-policy` route.",
  wordpress: "Go to Settings → Privacy → Create — WordPress makes a starter privacy page you can edit (it includes guidance text to replace). Publish it.",
  shopify: "Go to Settings → Policies → Privacy policy → Create from template. Edit it to match what you actually collect, then Save.",
  wix: "In the Editor click Pages & Menu → + Add Page → choose a Privacy Policy / Legal page template (or use a policy app from the Wix App Market), then edit it.",
  webflow: "Write the policy with a privacy policy generator (e.g. Termly or iubenda), then create a page \"Privacy policy\" (/privacy-policy) and paste it in.",
  framer: "Write the policy with a privacy policy generator (e.g. Termly or iubenda), then add a page \"Privacy policy\" (/privacy-policy) and paste it in.",
  squarespace: "Write the policy with a privacy policy generator (e.g. Termly or iubenda), then add a page \"Privacy policy\" (Pages → + → Blank page, in the Not Linked section) and paste it in.",
  custom: "Write the policy with a privacy policy generator (e.g. Termly or iubenda) and publish it at /privacy-policy.",
};

export const privacyPolicyGuide: FixGuide = {
  effect: () =>
    "We couldn't find a privacy policy. Visitors expect one, the law often requires it if you collect any personal data (contact forms, visitor tracking), and it's a basic sign of a real, trustworthy business.",
  steps: perPlatform((p) => [
    "List what personal data you collect: contact form details, newsletter emails, orders, cookies and visitor tracking (e.g. Google Analytics), and who you share it with.",
    PRIVACY_WRITE[p],
    "Include: who you are (<Brand> and your contact details), what you collect and why, how long you keep it, who you share it with, and how people can ask to see or delete their data.",
    "Have it checked against your country's rules (for example GDPR in the UK and EU, the DPDP Act in India, or state laws in the US). This guide isn't legal advice.",
    p === "shopify"
      ? "Show it in your footer: Online Store → Themes → Customize → Footer → turn on \"Show policy links\" (or add it to the Footer menu in Online Store → Navigation)."
      : footerLink(p, "/privacy-policy"),
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "Add app/privacy-policy/page.tsx with a privacy policy template (placeholders for company name, contact, data collected, processors such as analytics/email providers, retention, rights) and link it from the shared footer component. Mark clearly that it needs legal review.",
    react: "Add a /privacy-policy route with a placeholder policy template and link it in the footer; pre-render the route. Mark that it needs legal review.",
    custom: "Add a /privacy-policy page from a placeholder template and link it in the footer template. Mark that it needs legal review.",
  },
  verify: [
    "Scroll to the bottom of any page and click \"Privacy policy\" — it should open.",
    "Click \"Check website\" on Home. This problem should disappear from your list.",
  ],
  time: "30–60 minutes (plus a legal check)",
  category: "onsite",
};

// ---------------------------------------------------------------------------------------------------------------

const SOCIAL_ICONS: Record<Platform, string> = {
  nextjs: "Add icon links to your shared footer component: `<a href=\"https://www.linkedin.com/company/…\" aria-label=\"<Brand> on LinkedIn\">…</a>` for each profile.",
  react: "Add icon links to your shared footer component, one `<a href>` per profile with an `aria-label` like \"<Brand> on LinkedIn\".",
  wordpress: "Block themes: Appearance → Editor → Patterns → Footer → add a Social Icons block and paste each profile link. Classic themes: Appearance → Widgets → Footer → add a Social Icons block (or your theme's Customize → Social settings).",
  shopify: "Online Store → Themes → Customize → Theme settings (gear icon) → Social media: paste your profile links → Save. Most themes show them in the footer (turn on \"Show social media icons\" in the Footer section if needed).",
  wix: "In the Editor click + Add Elements → Social → Social Bar, put it in the footer, then click Set Social Links and add each profile.",
  webflow: "In your footer Symbol / Component, add a Link Block with an icon for each profile and paste the profile address in its link settings.",
  framer: "In your footer component, add an icon for each profile and set its Link to the profile address.",
  squarespace: "Add your profiles in Settings → Social links, then Edit → Edit Footer → add a Social Links block (or turn on social icons in the header).",
  custom: "Add icon links to your profiles in the shared footer template.",
};

export const socialProfilesGuide: FixGuide = {
  effect: (ctx) =>
    `Links from your site to ${ctx.brand}'s social profiles help people check you're real, and help AI assistants connect your business across the web.`,
  steps: perPlatform((p) => [
    "List the profiles you keep active: LinkedIn company page, Facebook, Instagram, YouTube, X, TikTok, Google Business Profile. Only link ones you actually use.",
    "Make sure each profile uses the same business name, logo and website address as your site.",
    SOCIAL_ICONS[p],
    "Add the same links to your business info for Google and AI (the profile list) — see \"AI can identify your business\" in your list.",
    PUBLISH[p],
  ]),
  promptHints: {
    nextjs:
      "Add social profile icon links (with aria-labels, rel=\"me noopener\") to the shared footer component and the same URLs to the Organization JSON-LD sameAs array in app/layout.tsx. Use placeholders for profile URLs you don't know.",
    react: "Add social profile links to the footer component and to sameAs in the Organization JSON-LD in index.html. Placeholders for unknown URLs.",
    custom: "Add social profile links to the footer template and to sameAs in the Organization JSON-LD. Placeholders for unknown URLs.",
  },
  verify: [
    "Scroll to the bottom of your home page — you should see icons that open each profile.",
    "Click \"Check website\" on Home. This problem should disappear from your list.",
  ],
  time: "15–20 minutes",
  category: "onsite",
};
