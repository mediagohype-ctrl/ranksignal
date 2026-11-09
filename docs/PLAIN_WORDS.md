# Plain words (UI copy)

Our customer is a small-business owner with no SEO knowledge. Every word on a customer screen must make
sense to them on first read. Source: RankSignal Developer Brief v1, sections 3 and 6.

Rules:
1. Keep the four score names **SEO, AEO, GEO and Brand** (owner's decision, 6 Nov 2026 — they read clearer to our users
   than the plain-word names the brief suggested). Always show the one-line meaning next to them (PILLAR_EXPLAINER).
   No schema, crawl, "risk class" or model ids on customer screens. Use the table below for everything else.
2. One line per card. Put the detail behind "Why?" or "See details".
3. Every error has a next step (Upgrade, Retry, Contact us).
4. Get plurals right: "1 page has", "2 pages have", "1 website" — never "page(s)" or "project(s)".
5. Capitalise roles: "Owner", "Admin", "Member".
6. Code identifiers, routes, API fields, database values and log keys do NOT change. Only the words people see.
7. **Public marketing pages (SEO exception, 9 Nov 2026):** `<title>`, meta description and the page's H1 may use
   the phrase people actually type into Google (e.g. "FAQ schema generator", "llms.txt generator", "SEO checker",
   "SEO, AEO & GEO services"). Nobody searches "FAQ info maker", so plain-word-only titles can't rank. Body copy
   stays in plain words, with the expert term in brackets where it helps. Guides under `/learn` explain the
   expert terms on purpose — that's what they're for.

## Word list

| Today | Use instead |
|---|---|
| Overview | Home |
| Report | Full report |
| SEO score | SEO (keep) |
| AEO score | AEO (keep; always shown, not Expert-only) |
| GEO score (the pillar) | GEO (keep) |
| GEO / AI visibility (the mention numbers) | AI mentions |
| Brand score | Brand (keep) |
| Website scan / crawl / run a scan | Website check / check your website |
| AI visibility check | AI check |
| Prompts / tracked questions | Customer questions |
| Actions & Approvals | Fixes to approve |
| Audit / findings | Website problems / problems |
| Work | Task board |
| Off-site | Outside your website |
| History & print | Score history |
| Integrations | Connect website |
| Class A | Safe (no change to your site) |
| Class B / C / D | Needs your OK |
| Meta description | Google summary |
| Page title / title tag | Google headline |
| Structured data / schema / FAQ markup | Info for Google and AI |
| Alt text | Image description |
| OG tags / Open Graph | Share preview |
| llms.txt | AI guide file |
| Canonical | Main version of the page |
| Indexable / noindex | Can appear on Google / hidden from Google |
| robots.txt | Your site's robot rules file |
| H1 / heading tag | Main heading |
| Crawler / bot | Google and AI robots |
| Citation / cited | Linked to your site |
| Mention rate | Named in X of Y answers |
| Share of voice | How often you're named vs competitors |
| openrouter:openai/gpt-… | ChatGPT (use the product name, never the model id) |
| LLM analysis | AI analysis |
| Draft fingerprint, priority score, confidence % | Hidden |
| Severity critical / high | Urgent |
| Severity medium | Important |
| Severity low / info | Nice to have |

## Score

One number out of 100 with one colour, the same everywhere:

| Score | Colour | Label |
|---|---|---|
| 75–100 | green | Good |
| 50–74 | yellow | Needs work |
| 0–49 | red | Poor |
| not measured | grey | Not checked yet |

When the website check is done but AI answers are not in yet, the score is **partial**: show
"Waiting for AI results" next to it.
