// Page readers for the MyWebRank SEO extension.
//
// Both functions are injected into the current tab with chrome.scripting.executeScript({ func }), which
// serialises the function's source. So each one MUST be fully self-contained: no imports, no references to
// anything outside its own body. They only READ the page (and, for fetchSiteFiles, two public files on the
// page's own origin); nothing is sent anywhere else.

/**
 * @typedef {{ level: number; text: string }} HeadingFact
 * @typedef {{
 *   url: string; origin: string; lang: string | null;
 *   titles: string[]; descriptions: string[]; canonicals: string[]; robots: string[];
 *   headings: HeadingFact[]; wordCount: number;
 *   images: { total: number; missingAlt: number; emptyAlt: number; missingAltExamples: string[] };
 *   links: { internal: number; external: number; nofollow: number };
 *   jsonLd: { blocks: number; invalid: number; types: string[] };
 *   openGraph: Record<string, string>; twitter: Record<string, string>;
 *   hreflang: { lang: string; href: string | null }[];
 * }} PageFacts
 */

/**
 * Read SEO facts from a document. In the extension it runs inside the page with no arguments; tests pass a
 * parsed document and its URL.
 * @param {any} [docArg]
 * @param {string | null} [urlArg]
 * @returns {PageFacts}
 */
export function collectPage(docArg, urlArg) {
  /* global document, location */
  const doc = docArg || document;
  const pageUrl = urlArg || location.href;
  const clean = (/** @type {string | null | undefined} */ s) => (s || "").replace(/\s+/g, " ").trim();
  const resolve = (/** @type {string} */ href) => {
    try {
      return new URL(href, pageUrl).href;
    } catch {
      return null;
    }
  };
  const hostOf = (/** @type {string} */ u) => {
    try {
      return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return null;
    }
  };
  const attr = (/** @type {any} */ el, /** @type {string} */ name) => {
    const v = el.getAttribute(name);
    return v === null || v === undefined ? null : String(v);
  };
  const relTokens = (/** @type {any} */ el) => (attr(el, "rel") || "").toLowerCase().split(/\s+/).filter(Boolean);
  const pageHost = hostOf(pageUrl);
  let origin = "";
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = "";
  }

  /** @type {PageFacts} */
  const facts = {
    url: pageUrl,
    origin,
    lang: null,
    titles: [],
    descriptions: [],
    canonicals: [],
    robots: [],
    headings: [],
    wordCount: 0,
    images: { total: 0, missingAlt: 0, emptyAlt: 0, missingAltExamples: [] },
    links: { internal: 0, external: 0, nofollow: 0 },
    jsonLd: { blocks: 0, invalid: 0, types: [] },
    openGraph: {},
    twitter: {},
    hreflang: [],
  };
  const root = doc.documentElement;
  if (!root) return facts;
  facts.lang = clean(attr(root, "lang")) || null;

  const NO_TEXT = { script: 1, style: 1, noscript: 1, template: 1, svg: 1, iframe: 1, head: 1, title: 1 };
  const typeSet = new Set();
  const addTypes = (/** @type {any} */ node, /** @type {number} */ depth) => {
    if (!node || typeof node !== "object" || depth > 3) return;
    if (Array.isArray(node)) {
      node.forEach((n) => addTypes(n, depth + 1));
      return;
    }
    const t = node["@type"];
    (Array.isArray(t) ? t : [t]).forEach((x) => {
      if (typeof x === "string" && x) typeSet.add(x.replace(/^https?:\/\/schema\.org\//, ""));
    });
    if (node["@graph"]) addTypes(node["@graph"], depth + 1);
  };

  let words = 0;
  const countWords = (/** @type {string} */ s) => {
    for (const w of s.split(/\s+/)) if (/[\p{L}\p{N}]/u.test(w)) words++;
  };

  // Iterative walk: [node, insideSvg, textCounts]
  /** @type {[any, boolean, boolean][]} */
  const stack = [[root, false, false]];
  let visited = 0;
  while (stack.length && visited < 200000) {
    const [node, inSvg, inBody] = /** @type {[any, boolean, boolean]} */ (stack.pop());
    visited++;
    if (node.nodeType === 3) {
      if (inBody && node.nodeValue) countWords(node.nodeValue);
      continue;
    }
    if (node.nodeType !== 1) continue;
    const tag = String(node.tagName || "").toLowerCase();
    const svg = inSvg || tag === "svg";
    let body = inBody || tag === "body";
    if (tag in NO_TEXT) body = false;

    if (!svg) {
      if (tag === "title") {
        if (facts.titles.length < 10) facts.titles.push(clean(node.textContent));
      } else if (tag === "meta") {
        const name = (attr(node, "name") || "").toLowerCase();
        const prop = (attr(node, "property") || "").toLowerCase();
        const content = clean(attr(node, "content"));
        if (name === "description") facts.descriptions.push(content);
        else if (name === "robots" || name === "googlebot") facts.robots.push(content);
        const key = prop || name;
        if (key.startsWith("og:") && !(key in facts.openGraph)) facts.openGraph[key] = content;
        if (key.startsWith("twitter:") && !(key in facts.twitter)) facts.twitter[key] = content;
      } else if (tag === "link") {
        const rel = relTokens(node);
        const href = attr(node, "href");
        if (rel.includes("canonical") && href !== null) facts.canonicals.push(resolve(href) || href);
        const hl = attr(node, "hreflang");
        if (rel.includes("alternate") && hl && facts.hreflang.length < 300) {
          facts.hreflang.push({ lang: clean(hl), href: href === null ? null : resolve(href) });
        }
      } else if (/^h[1-6]$/.test(tag)) {
        if (facts.headings.length < 500) facts.headings.push({ level: Number(tag[1]), text: clean(node.textContent).slice(0, 200) });
      } else if (tag === "img") {
        facts.images.total++;
        const alt = attr(node, "alt");
        if (alt === null) {
          facts.images.missingAlt++;
          const src = attr(node, "src") || attr(node, "data-src");
          if (src && facts.images.missingAltExamples.length < 5) facts.images.missingAltExamples.push(resolve(src) || src);
        } else if (!alt.trim()) facts.images.emptyAlt++;
      } else if (tag === "a") {
        const raw = attr(node, "href");
        const href = raw === null ? null : resolve(raw.trim());
        if (href && raw !== null && !raw.trim().startsWith("#") && /^https?:/i.test(href)) {
          if (hostOf(href) === pageHost) facts.links.internal++;
          else facts.links.external++;
          if (relTokens(node).some((r) => r === "nofollow" || r === "sponsored" || r === "ugc")) facts.links.nofollow++;
        }
      } else if (tag === "script" && (attr(node, "type") || "").toLowerCase().trim() === "application/ld+json") {
        facts.jsonLd.blocks++;
        try {
          addTypes(JSON.parse(node.textContent || ""), 0);
        } catch {
          facts.jsonLd.invalid++;
        }
      }
    }

    const kids = node.childNodes || [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push([kids[i], svg, body]);
  }
  facts.wordCount = words;
  facts.jsonLd.types = Array.from(typeSet).slice(0, 50).map(String);
  return facts;
}

/**
 * @typedef {{ status: number | null; contentType: string; text: string | null; error?: string }} FetchedFile
 * @typedef {{ origin: string; robots: FetchedFile; llms: FetchedFile }} SiteFiles
 */

/**
 * Fetch /robots.txt and /llms.txt from the page's own origin (same-origin, no cookies, 6 s timeout, 256 KB cap).
 * Runs inside the page with no arguments.
 * @param {string | null} [originArg]
 * @returns {Promise<SiteFiles>}
 */
export async function fetchSiteFiles(originArg) {
  /* global location */
  const origin = originArg || location.origin;
  const MAX_BYTES = 256 * 1024;
  /** @returns {Promise<FetchedFile>} */
  async function get(/** @type {string} */ path) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(origin + path, { signal: ctrl.signal, credentials: "omit", cache: "no-store", redirect: "follow" });
      const contentType = res.headers.get("content-type") || "";
      let text = null;
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let bytes = 0;
        text = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          text += decoder.decode(value, { stream: true });
          if (bytes >= MAX_BYTES) {
            await reader.cancel();
            break;
          }
        }
      }
      return { status: res.status, contentType, text };
    } catch (e) {
      return { status: null, contentType: "", text: null, error: String((e && /** @type {Error} */ (e).message) || e) };
    } finally {
      clearTimeout(timer);
    }
  }
  const [robots, llms] = await Promise.all([get("/robots.txt"), get("/llms.txt")]);
  return { origin, robots, llms };
}
