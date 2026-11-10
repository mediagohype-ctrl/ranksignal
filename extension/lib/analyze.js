// Turn the facts read from a page into plain-English checks (pure, no I/O). Wording follows the website's
// audit (src/lib/audit/rules.ts) and meta tag checker (src/lib/tools/meta-tags.ts), so a page reads the
// same in the extension and in the full report.
import {
  DESCRIPTION_MAX,
  DESCRIPTION_SHORT,
  QUESTION_START,
  THIN_WORDS,
  TITLE_MAX,
  TITLE_MIN,
  TITLE_SHORT,
} from "./constants.js";

/**
 * @typedef {import("./extract.js").PageFacts} PageFacts
 * @typedef {import("./extract.js").SiteFiles} SiteFiles
 * @typedef {import("./robots.js").RobotsSummary} RobotsSummary
 * @typedef {"good" | "warn" | "bad" | "info"} Status
 * @typedef {"basics" | "headings" | "content" | "sharing" | "ai"} Section
 * @typedef {{ id: string; section: Section; label: string; status: Status; message: string; value?: string; tool?: string }} Check
 * @typedef {{ level: number; text: string; problem: string | null }} OutlineItem
 */

const plural = (/** @type {number} */ n, /** @type {string} */ one, /** @type {string} */ many) => (n === 1 ? one : many);

/** @param {string} u */
function hostOf(u) {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Same idea as isQuestionHeading in src/lib/crawler/extract.ts. @param {string} text */
export function isQuestionHeading(text) {
  const t = text.trim();
  return t.length >= 6 && (t.endsWith("?") || QUESTION_START.test(t));
}

/** @param {string | null} title @returns {{ status: Status; message: string }} */
export function titleCheck(title) {
  if (!title) return { status: "bad", message: "This page has no Google headline (title tag)." };
  const n = title.length;
  if (n < TITLE_MIN) return { status: "warn", message: `The Google headline is only ${n} characters and may not say what the page is about.` };
  if (n < TITLE_SHORT)
    return { status: "warn", message: `The Google headline is ${n} characters. Aim for ${TITLE_SHORT} to ${TITLE_MAX} so it names your service and place.` };
  if (n > TITLE_MAX)
    return { status: "warn", message: `The Google headline is ${n} characters, so Google may cut it off (aim for ${TITLE_MAX} or fewer).` };
  return { status: "good", message: `${n} characters: a good length (${TITLE_SHORT} to ${TITLE_MAX}).` };
}

/** @param {string | null} description @returns {{ status: Status; message: string }} */
export function descriptionCheck(description) {
  if (!description)
    return { status: "bad", message: "This page has no Google summary, so Google shows random text from the page instead." };
  const n = description.length;
  if (n < DESCRIPTION_SHORT)
    return { status: "warn", message: `The Google summary is only ${n} characters. Aim for ${DESCRIPTION_SHORT} to ${DESCRIPTION_MAX}.` };
  if (n > DESCRIPTION_MAX) return { status: "warn", message: `The Google summary is ${n} characters, so Google may cut it off.` };
  return { status: "good", message: `${n} characters: a good length (${DESCRIPTION_SHORT} to ${DESCRIPTION_MAX}).` };
}

/** H1–H6 outline with a problem noted on each heading that has one. @param {PageFacts["headings"]} headings */
export function headingOutline(headings) {
  /** @type {OutlineItem[]} */
  const items = [];
  let h1Seen = 0;
  headings.forEach((h, i) => {
    /** @type {string | null} */
    let problem = null;
    if (!h.text) problem = "Empty heading";
    if (h.level === 1) {
      h1Seen++;
      if (h1Seen > 1) problem = problem ?? "Extra main heading (H1)";
    }
    const prev = i > 0 ? headings[i - 1].level : null;
    if (prev !== null && h.level > prev + 1) problem = problem ?? `Jumps from H${prev} to H${h.level}`;
    if (i === 0 && h.level > 1 && headings.every((x) => x.level !== 1)) problem = problem ?? "Page has no H1";
    items.push({ level: h.level, text: h.text, problem });
  });
  return items;
}

/**
 * @param {PageFacts} facts
 * @param {{ robots?: RobotsSummary | null; llms?: SiteFiles["llms"] | null }} [site]
 */
export function analyzePage(facts, site = {}) {
  /** @type {Check[]} */
  const checks = [];
  const add = (/** @type {Check} */ c) => checks.push(c);
  const pageHost = hostOf(facts.url);

  // ---- Basics ----
  const title = facts.titles.find((t) => t) ?? null;
  const tc = titleCheck(title);
  add({ id: "title", section: "basics", label: "Google headline (title)", ...tc, value: title ?? undefined, tool: "meta" });
  if (facts.titles.length > 1)
    add({ id: "title_multiple", section: "basics", label: "Google headline (title)", status: "warn", tool: "meta",
      message: `This page has ${facts.titles.length} title tags. A theme and a plugin may both be adding one.` });

  const description = facts.descriptions.find((d) => d) ?? null;
  const dc = descriptionCheck(description);
  add({ id: "description", section: "basics", label: "Google summary (meta description)", ...dc, value: description ?? undefined, tool: "meta" });
  if (facts.descriptions.length > 1)
    add({ id: "description_multiple", section: "basics", label: "Google summary (meta description)", status: "warn", tool: "meta",
      message: `This page has ${facts.descriptions.length} meta descriptions. Keep one.` });

  const canonical = facts.canonicals[0] ?? null;
  if (!canonical) {
    add({ id: "canonical", section: "basics", label: "Main version (canonical)", status: "warn", tool: "meta",
      message: "This page doesn't say which version is the main version of the page." });
  } else if (hostOf(canonical) !== pageHost) {
    add({ id: "canonical", section: "basics", label: "Main version (canonical)", status: "bad", value: canonical, tool: "meta",
      message: "This page tells Google that a page on another website is the main version, so this page may be hidden from Google." });
  } else {
    const same = canonical.replace(/#.*$/, "") === facts.url.replace(/#.*$/, "");
    add({ id: "canonical", section: "basics", label: "Main version (canonical)", status: same ? "good" : "info", value: canonical, tool: "meta",
      message: same ? "Points to this page." : "Points to a different page on this site. Fine for copies of a page; check it is on purpose." });
  }
  if (facts.canonicals.length > 1)
    add({ id: "canonical_multiple", section: "basics", label: "Main version (canonical)", status: "warn", tool: "meta",
      message: `This page has ${facts.canonicals.length} canonical links. Google may ignore all of them.` });

  const robots = facts.robots.filter(Boolean).join(", ");
  if (/\bnoindex\b|\bnone\b/i.test(robots)) {
    add({ id: "robots", section: "basics", label: "Robots meta tag", status: "bad", value: robots, tool: "meta",
      message: "This page is hidden from Google by a setting on the page (noindex). Check that this is on purpose." });
  } else if (/\bnofollow\b/i.test(robots)) {
    add({ id: "robots", section: "basics", label: "Robots meta tag", status: "warn", value: robots, tool: "meta",
      message: "Google is told not to follow the links on this page (nofollow)." });
  } else {
    add({ id: "robots", section: "basics", label: "Robots meta tag", status: "good", value: robots || undefined, tool: "meta",
      message: robots ? "Google may list this page." : "No robots meta tag, so Google may list this page." });
  }

  add(facts.lang
    ? { id: "lang", section: "basics", label: "Page language", status: "good", value: facts.lang, message: "The page says what language it's in." }
    : { id: "lang", section: "basics", label: "Page language", status: "warn", message: "This page doesn't say what language it's in (html lang)." });

  // ---- Headings ----
  const outline = headingOutline(facts.headings);
  const h1s = facts.headings.filter((h) => h.level === 1);
  if (h1s.length === 0)
    add({ id: "h1", section: "headings", label: "Main heading (H1)", status: "warn", tool: "headings", message: "This page has no main heading." });
  else if (h1s.length > 1)
    add({ id: "h1", section: "headings", label: "Main heading (H1)", status: "warn", tool: "headings",
      message: `This page has ${h1s.length} main headings. One clear main heading is easier to understand.` });
  else add({ id: "h1", section: "headings", label: "Main heading (H1)", status: "good", value: h1s[0].text, tool: "headings", message: "One main heading." });
  const skips = outline.filter((o) => o.problem && o.problem.startsWith("Jumps")).map((o) => o.problem);
  if (skips.length)
    add({ id: "heading_skips", section: "headings", label: "Heading order", status: "warn", tool: "headings",
      message: `Headings jump levels (${skips.slice(0, 3).map((s) => String(s).replace("Jumps from ", "").replace(" to ", "→")).join(", ")}), which muddles the page layout.` });
  const empty = facts.headings.filter((h) => !h.text).length;
  if (empty)
    add({ id: "heading_empty", section: "headings", label: "Empty headings", status: "warn", tool: "headings",
      message: `${empty} ${plural(empty, "heading is", "headings are")} empty.` });

  // ---- Content ----
  add(facts.wordCount < THIN_WORDS
    ? { id: "words", section: "content", label: "Word count", status: "warn", value: String(facts.wordCount),
        message: `This page has only about ${facts.wordCount} words, so it may not answer customers' questions in enough detail.` }
    : { id: "words", section: "content", label: "Word count", status: "good", value: String(facts.wordCount), message: `About ${facts.wordCount} words.` });

  const img = facts.images;
  add(img.missingAlt
    ? { id: "alt", section: "content", label: "Image descriptions (alt)", status: "warn", value: `${img.missingAlt} of ${img.total}`,
        message: `${img.missingAlt} ${plural(img.missingAlt, "image has", "images have")} no image description.` }
    : { id: "alt", section: "content", label: "Image descriptions (alt)", status: img.total ? "good" : "info", value: `${img.total} ${plural(img.total, "image", "images")}`,
        message: img.total
          ? `Every image has an alt attribute${img.emptyAlt ? ` (${img.emptyAlt} marked decorative with alt="")` : ""}.`
          : "No images on this page." });

  add({ id: "links", section: "content", label: "Links", status: facts.links.internal === 0 ? "warn" : "info", tool: "links",
    value: `${facts.links.internal} internal · ${facts.links.external} external`,
    message: facts.links.internal === 0
      ? "No links to other pages on this site. Internal links help Google and visitors find your other pages."
      : `${facts.links.internal} internal and ${facts.links.external} external ${plural(facts.links.external, "link", "links")}${facts.links.nofollow ? `, ${facts.links.nofollow} marked nofollow/sponsored/ugc` : ""}.` });

  // ---- Structured data and sharing ----
  const types = facts.jsonLd.types;
  if (facts.jsonLd.invalid)
    add({ id: "schema_invalid", section: "sharing", label: "Structured data (JSON-LD)", status: "warn", tool: "schema",
      message: "The info for Google and AI on this page is broken and can't be read." });
  add(types.length
    ? { id: "schema", section: "sharing", label: "Structured data (JSON-LD)", status: "good", value: types.join(", "), tool: "schema",
        message: `Found ${types.length} ${plural(types.length, "type", "types")} of info for Google and AI.` }
    : { id: "schema", section: "sharing", label: "Structured data (JSON-LD)", status: "warn", tool: "schema",
        message: "No info for Google and AI (structured data) on this page." });

  const og = facts.openGraph;
  const ogMissing = ["og:title", "og:description", "og:image"].filter((k) => !og[k]);
  add(ogMissing.length
    ? { id: "og", section: "sharing", label: "Share preview (Open Graph)", status: "warn", tool: "meta",
        message: `Missing ${ogMissing.join(", ")}. Links shared on WhatsApp, LinkedIn or Facebook may show ${ogMissing.includes("og:image") ? "a blank box instead of a picture" : "a weaker preview"}.` }
    : { id: "og", section: "sharing", label: "Share preview (Open Graph)", status: "good", value: og["og:title"], tool: "meta",
        message: "Title, description and image are set for shared links." });
  const tw = facts.twitter;
  add({ id: "twitter", section: "sharing", label: "X (Twitter) card", status: tw["twitter:card"] ? "good" : "info", tool: "meta",
    value: tw["twitter:card"] || undefined,
    message: tw["twitter:card"] ? "X card is set." : "No twitter:card tag. X falls back to the Open Graph tags." });

  const hl = facts.hreflang;
  if (hl.length) {
    const broken = hl.filter((h) => !h.href).length;
    const hasDefault = hl.some((h) => h.lang.toLowerCase() === "x-default");
    add({ id: "hreflang", section: "sharing", label: "Language versions (hreflang)", status: broken ? "warn" : "good",
      value: hl.map((h) => h.lang).slice(0, 12).join(", "),
      message: broken
        ? `${broken} hreflang ${plural(broken, "link has", "links have")} no address.`
        : `${hl.length} language ${plural(hl.length, "version", "versions")} listed${hasDefault ? ", including x-default" : ""}.` });
  } else {
    add({ id: "hreflang", section: "sharing", label: "Language versions (hreflang)", status: "info",
      message: "No hreflang links. You only need them if the page exists in other languages or regions." });
  }

  // ---- AI readiness ----
  const questions = facts.headings.filter((h) => h.level >= 2 && isQuestionHeading(h.text));
  const hasFaq = types.includes("FAQPage");
  const questionStyle = facts.headings.filter((h) => h.level >= 2 && h.text.trim().endsWith("?")).length >= 2;
  if (hasFaq) {
    add({ id: "faq", section: "ai", label: "Questions and answers", status: "good", tool: "faq",
      value: `${questions.length} question ${plural(questions.length, "heading", "headings")}`,
      message: "Questions are labelled for Google and AI (FAQPage)." });
  } else if (questionStyle && !types.includes("HowTo")) {
    add({ id: "faq", section: "ai", label: "Questions and answers", status: "warn", tool: "faq",
      value: `${questions.length} question ${plural(questions.length, "heading", "headings")}`,
      message: "This page is built around questions, but they aren't labelled as questions and answers for Google and AI. Labels make the answers easier to read; they don't make Google or AI use them." });
  } else {
    add({ id: "faq", section: "ai", label: "Questions and answers", status: "info", tool: "faq",
      value: `${questions.length} question ${plural(questions.length, "heading", "headings")}`,
      message: questions.length
        ? "Some headings ask questions. Short, direct answers under them are easy for AI tools to quote."
        : "No headings ask a customer's question. Question headings with short answers are easy for AI tools to quote." });
  }

  const llms = site.llms;
  if (llms) {
    const isText = llms.status === 200 && llms.text !== null && !/html/i.test(llms.contentType) && !/^\s*</.test(llms.text);
    add(isText
      ? { id: "llms", section: "ai", label: "AI guide file (llms.txt)", status: "good", tool: "llms", message: "Found an AI guide file at /llms.txt." }
      : { id: "llms", section: "ai", label: "AI guide file (llms.txt)", status: "info", tool: "llms",
          message: llms.status === null
            ? "We couldn't read /llms.txt from this site."
            : "No AI guide file was found. It's a new idea with no proven effect on AI mentions yet, so treat it as optional." });
  }

  const rb = site.robots;
  if (rb) {
    const blocked = rb.bots.filter((b) => !b.allowed);
    const blocksSearch = blocked.some((b) => b.purpose !== "training");
    if (!rb.fetched) {
      add({ id: "ai_bots", section: "ai", label: "AI robots (robots.txt)", status: "info", tool: "aiCrawlers",
        message: rb.status === null ? "We couldn't read this site's robots.txt, so we can't tell which AI robots are allowed." : "No robots.txt file, so all AI robots are allowed in." });
    } else if (rb.blocksEveryone) {
      add({ id: "ai_bots", section: "ai", label: "AI robots (robots.txt)", status: "bad", tool: "robots",
        message: "This site's robots.txt blocks every robot from the homepage, including Google and AI assistants." });
    } else if (blocked.length) {
      add({ id: "ai_bots", section: "ai", label: "AI robots (robots.txt)", status: blocksSearch ? "warn" : "info", tool: "aiCrawlers",
        value: blocked.map((b) => b.token).join(", "),
        message: `Your site's robot rules file blocks ${blocked.length === 1 ? "this AI robot" : "these AI robots"}: ${blocked.map((b) => b.token).join(", ")}. ${blocksSearch
          ? "Blocking AI robots that answer live questions can stop AI assistants from reading your pages and linking to you."
          : "These robots mainly collect training data. Blocking them is a business choice and may not affect live AI answers."}` });
    } else {
      add({ id: "ai_bots", section: "ai", label: "AI robots (robots.txt)", status: "good", tool: "aiCrawlers",
        message: "ChatGPT, Perplexity, Claude and the other AI robots we check are allowed to read the homepage." });
    }
  }

  /** @type {Record<Status, number>} */
  const summary = { good: 0, warn: 0, bad: 0, info: 0 };
  for (const c of checks) summary[c.status]++;
  return { url: facts.url, origin: facts.origin, checks, outline, summary };
}
