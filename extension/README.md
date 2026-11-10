# MyWebRank SEO Check — browser extension

A Chrome (Manifest V3) extension that also loads in Microsoft Edge. Click the toolbar icon on any web page to see,
for that page:

- Google headline (title) and summary (meta description) with length verdicts
- canonical link, robots meta tag (noindex warning), `html lang`
- H1–H6 outline with missing / repeated / empty / skipped headings marked
- word count, images with no `alt`, internal and external link counts
- structured data (JSON-LD) types and broken JSON-LD
- Open Graph and X (Twitter) tags, hreflang
- AI readiness: question headings, FAQPage markup, `/llms.txt`, and which AI robots `/robots.txt` lets in

Plain ES modules, HTML and CSS. No build step and no dependencies.

## Files

| Path | What it is |
| --- | --- |
| `manifest.json` | MV3 manifest. Permissions: `activeTab`, `scripting` only. |
| `popup.html`, `popup.css`, `popup.js` | The 380 px popup. Renders with `textContent` only (page text is untrusted). |
| `lib/extract.js` | `collectPage` and `fetchSiteFiles`, injected into the tab with `chrome.scripting.executeScript({ func })`. Each must stay self-contained (no imports or outside references) because Chrome serialises the function source. |
| `lib/analyze.js` | Pure: turns page facts into checks, with the website's wording. |
| `lib/robots.js` | Pure: small RFC 9309 reader for AI robot rules. |
| `lib/constants.js` | Limits and the AI robot list, copied from `src/lib/audit/rules.ts`, `src/lib/tools/meta-tags.ts`, `src/lib/crawler/extract.ts` and `src/lib/audit/ai-bots.ts`. `tests/extension` fails if they drift. |
| `icons/` | PNG icons (16, 32, 48, 128) made from `public/brand/logo-mark.svg`. Regenerate with `node extension/scripts/make-icons.mjs` from the repo root (uses `sharp`, already a site dependency). |

Tests: `npx vitest run tests/extension`.

## Load it unpacked (development)

**Chrome**

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose this `extension/` folder.
4. Pin "MyWebRank SEO Check" from the puzzle-piece menu, open any website and click the icon.

**Microsoft Edge**

1. Open `edge://extensions`.
2. Turn on **Developer mode** (left sidebar).
3. Click **Load unpacked** and choose this `extension/` folder.

After editing files, press the reload icon on the extension's card and reopen the popup.

Browsers do not let extensions read `chrome://` pages, the Chrome Web Store or the built-in PDF viewer; the popup
says so on those pages.

## Package for the Chrome Web Store

1. Bump `version` in `manifest.json` (the store rejects a version it has seen before).
2. From the repo root, zip the folder contents (the manifest must be at the root of the zip), leaving out `scripts/`
   and this README:

   PowerShell:
   ```powershell
   $files = Get-ChildItem extension -Exclude scripts, README.md
   Compress-Archive -Path $files.FullName -DestinationPath mywebrank-extension.zip -Force
   ```

   Bash:
   ```bash
   cd extension && zip -r ../mywebrank-extension.zip . -x 'scripts/*' 'README.md' && cd ..
   ```
3. In the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) (one-time US$5
   registration fee), choose **New item**, upload the zip and fill in the listing below.
4. Privacy tab: single purpose = "Shows SEO and AI-readiness checks for the current page". Justify `activeTab` ("read
   the page the user clicks the icon on") and `scripting` ("run the page check in that tab"). Data usage: tick
   **none** of the data categories; certify that no data is sold or transferred. Privacy policy URL:
   https://mywebrank.tech/privacy.
5. The same zip can be submitted to the [Microsoft Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge)
   store (free).
6. When the listing is live, replace the "Coming soon to the Chrome Web Store" note on
   `src/app/(marketing)/tools/seo-extension/page.tsx` with the store link.

Store assets you still need: at least one 1280 × 800 screenshot of the popup, and a 440 × 280 small promo tile.
`icons/icon-128.png` is the store icon.

## Privacy statement

The MyWebRank SEO Check extension works entirely in your browser.

- It reads only the tab you click its icon on, at the moment you click (`activeTab`). It has no access to other tabs
  or to sites you have not clicked it on.
- To check AI robot rules it requests `/robots.txt` and `/llms.txt` from that same website, without cookies.
- It has no analytics, no tracking, no account, no remote code and no storage. Nothing it reads is sent to MyWebRank
  or anyone else.
- Data leaves your browser only when you click a link in the popup. "Run the full free check" opens
  `https://mywebrank.tech/free-check?url=<the site's address>`; the tool links open pages on mywebrank.tech. Those
  pages follow the MyWebRank privacy policy at https://mywebrank.tech/privacy.

## Store listing draft

**Name:** MyWebRank SEO Check

**Summary (≤ 132 characters):**
Check any page's SEO and AI readiness in one click: title, description, headings, schema, share tags and AI robot rules.

**Category:** Developer Tools (alternative: Productivity)

**Language:** English (India)

**Description:**

> See how any web page looks to Google and AI assistants, in one click and in plain English.
>
> Open a page, click the MyWebRank icon, and you get:
>
> • Google headline and summary — is the title tag and meta description there, and the right length?
> • Main version and indexing — canonical link, robots meta tag (with a clear warning if the page is hidden from Google by noindex) and page language.
> • Headings — the H1 to H6 outline, with missing, repeated, empty and skipped headings marked.
> • Content — word count, images with no alt text, internal and external links.
> • Structured data — every JSON-LD type on the page, such as LocalBusiness, Product or FAQPage, and broken code.
> • Share previews — Open Graph and X (Twitter) tags, plus hreflang language versions.
> • AI readiness — question headings, FAQ markup, an llms.txt file, and which AI robots (ChatGPT, Perplexity, Claude and more) the site's robots.txt lets in.
>
> Problems come first, with a link to a free MyWebRank tool that goes deeper. Want the whole site? "Run the full free check" opens the MyWebRank free website check with the site filled in, for SEO, AEO and GEO scores.
>
> Private by design: the checks run in your browser. The extension asks only for activeTab and scripting, so it can read just the tab you click it on. No tracking, no account, nothing sent anywhere unless you click a link.
>
> Made by MyWebRank (https://mywebrank.tech) for small businesses, marketers and agencies.
