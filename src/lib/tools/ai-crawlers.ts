// "Is my site blocked from AI?" (pure). Combines robots.txt access per AI crawler (analyzeAiBots) with page-level
// signals on the homepage (robots meta tags and the X-Robots-Tag header). Blocking training crawlers is reported
// as a legitimate business choice; blocking AI search/answer crawlers is reported as hiding the site from answers.
import * as cheerio from "cheerio";
import { AI_BOTS, analyzeAiBots, type AiBotRule } from "@/lib/audit/ai-bots";

export type AiGroup = "answers" | "training";

export interface AiCrawlerRow extends AiBotRule {
  group: AiGroup;
  note?: string;
}

export interface PageSignal {
  /** Where we saw it: `meta name="robots"`, `meta name="googlebot"`, or the X-Robots-Tag header. */
  source: string;
  /** Crawler the directive is aimed at ("all" for robots / unprefixed header values). */
  appliesTo: string;
  directive: string;
  tone: "danger" | "warning" | "info";
  meaning: string;
}

export interface AiCrawlerReport {
  robotsUrl: string;
  robotsStatus: number | null;
  robotsFound: boolean;
  blocksEveryone: boolean;
  answers: AiCrawlerRow[];
  training: AiCrawlerRow[];
  pageChecked: boolean;
  pageStatus: number | null;
  signals: PageSignal[];
  summary: { tone: "success" | "warning" | "danger" | "info"; title: string; body: string };
  snippets: { allowSearchBlockTraining: string; allowAll: string };
}

const NOTES: Record<string, string> = {
  "Google-Extended":
    "Not a separate crawler: Googlebot does the fetching. This robots.txt token only tells Google whether Gemini may use your pages for training and grounding. It does not affect Google Search or AI Overviews.",
  "Applebot-Extended": "Also a robots.txt token, not a crawler. Applebot fetches pages; this token controls use for Apple's AI training.",
  "ChatGPT-User": "Fetches a page when a ChatGPT user asks about it. OpenAI says robots.txt may not apply to these user-initiated visits.",
  "Perplexity-User": "Fetches a page when a Perplexity user asks about it. Perplexity says it generally ignores robots.txt for these visits.",
};

/** Directives we look for, with what they mean in plain English. */
const DIRECTIVES: Record<string, { tone: PageSignal["tone"]; meaning: string }> = {
  noindex: { tone: "danger", meaning: "The page is kept out of Google Search, including AI Overviews and AI Mode, and out of other search engines that honour it." },
  none: { tone: "danger", meaning: "Same as noindex plus nofollow: the page is kept out of search results and AI answers built on them." },
  nosnippet: { tone: "warning", meaning: "Google won't show text from this page in results or use it as a direct source in AI Overviews or AI Mode." },
  "max-snippet:0": { tone: "warning", meaning: "Same effect as nosnippet: no text from this page in Google results or AI Overviews." },
  noai: { tone: "info", meaning: "Asks AI tools not to train on this page. It is not an official standard: Google and OpenAI don't document support for it." },
  noimageai: { tone: "info", meaning: "Asks AI tools not to train on images on this page. It is not an official standard and support is limited." },
};

/** Directives that themselves take a "name: value" form, so their name is not a crawler prefix. */
const VALUE_DIRECTIVES = new Set(["max-snippet", "max-image-preview", "max-video-preview", "unavailable_after"]);

const BOT_META_NAMES = new Set(["robots", "googlebot", "bingbot", ...AI_BOTS.map((b) => b.token.toLowerCase())]);

function splitDirectives(content: string): string[] {
  return content
    .toLowerCase()
    .split(",")
    .map((d) => d.trim().replace(/\s*:\s*/g, ":"))
    .filter(Boolean);
}

function signalsFrom(source: string, appliesTo: string, content: string): PageSignal[] {
  const out: PageSignal[] = [];
  for (const d of splitDirectives(content)) {
    const info = DIRECTIVES[d];
    if (info) out.push({ source, appliesTo, directive: d, ...info });
  }
  return out;
}

/** Robots meta tags (robots, googlebot, bingbot, AI bot names) and X-Robots-Tag header values on one page. */
export function pageAiSignals(html: string, xRobotsTag: string | null): PageSignal[] {
  const signals: PageSignal[] = [];
  if (html) {
    const $ = cheerio.load(html);
    $("meta[name]").each((_, el) => {
      const name = ($(el).attr("name") ?? "").trim().toLowerCase();
      if (!BOT_META_NAMES.has(name)) return;
      const content = $(el).attr("content") ?? "";
      signals.push(...signalsFrom(`<meta name="${name}">`, name === "robots" ? "all" : name, content));
    });
  }
  if (xRobotsTag) {
    // Several headers arrive comma-joined. "botname: a, b" targets one crawler until the next "otherbot:" prefix.
    let bot = "all";
    for (const part of xRobotsTag.split(",")) {
      const m = /^\s*([a-z0-9_-]+)\s*:\s*(.+)$/i.exec(part);
      if (m && !VALUE_DIRECTIVES.has(m[1].toLowerCase())) {
        bot = m[1].toLowerCase();
        signals.push(...signalsFrom("X-Robots-Tag header", bot, m[2]));
      } else {
        signals.push(...signalsFrom("X-Robots-Tag header", bot, part));
      }
    }
  }
  // De-duplicate identical findings.
  const seen = new Set<string>();
  return signals.filter((s) => {
    const k = `${s.source}|${s.appliesTo}|${s.directive}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const tokensFor = (g: AiGroup) => AI_BOTS.filter((b) => (g === "training" ? b.purpose === "training" : b.purpose !== "training")).map((b) => b.token);

function snippet(tokens: string[], rule: string): string {
  return tokens.map((t) => `User-agent: ${t}\n${rule}`).join("\n\n");
}

/** Ready-to-paste robots.txt blocks. They add AI-specific groups and leave your existing `User-agent: *` group alone. */
export function aiRobotsSnippets(): AiCrawlerReport["snippets"] {
  return {
    allowSearchBlockTraining: [
      "# AI search and answer tools: allowed",
      snippet(tokensFor("answers"), "Allow: /"),
      "",
      "# AI training: blocked",
      snippet(tokensFor("training"), "Disallow: /"),
    ].join("\n"),
    allowAll: ["# All AI crawlers: allowed", snippet([...tokensFor("answers"), ...tokensFor("training")], "Allow: /")].join("\n"),
  };
}

export function buildAiCrawlerReport(input: {
  robotsUrl: string;
  robotsText: string | null;
  robotsStatus: number | null;
  html: string | null;
  pageStatus: number | null;
  xRobotsTag: string | null;
}): AiCrawlerReport {
  const robots = analyzeAiBots(input.robotsUrl, input.robotsText, input.robotsStatus);
  const rows: AiCrawlerRow[] = robots.aiBots.map((b) => ({
    ...b,
    group: b.purpose === "training" ? "training" : "answers",
    ...(NOTES[b.token] ? { note: NOTES[b.token] } : {}),
  }));
  const answers = rows.filter((r) => r.group === "answers");
  const training = rows.filter((r) => r.group === "training");
  const pageChecked = input.html !== null;
  const signals = pageChecked || input.xRobotsTag ? pageAiSignals(input.html ?? "", input.xRobotsTag) : [];

  const blockedAnswers = answers.filter((r) => !r.allowed);
  const blockedTraining = training.filter((r) => !r.allowed);
  const hidden = signals.some((s) => s.tone === "danger" && (s.appliesTo === "all" || s.appliesTo === "googlebot"));
  let summary: AiCrawlerReport["summary"];
  if (input.robotsStatus !== null && (input.robotsStatus >= 500 || input.robotsStatus === 429)) {
    summary = {
      tone: "danger",
      title: "Your robots.txt is returning a server error",
      body: `It answered HTTP ${input.robotsStatus}. Google treats the whole site as blocked while that lasts, and other crawlers may back off too. Fix the server error first.`,
    };
  } else if (robots.blocksEveryone || hidden) {
    summary = {
      tone: "danger",
      title: "Your homepage is hidden from search and AI",
      body: robots.blocksEveryone
        ? "Your robots.txt blocks every crawler from the whole site. Unless that's deliberate, remove the Disallow: / line under User-agent: *."
        : "Your homepage carries a noindex instruction, so it is kept out of Google and the AI answers built on search results.",
    };
  } else if (blockedAnswers.length) {
    summary = {
      tone: "warning",
      title: `${blockedAnswers.length} AI search tool${blockedAnswers.length === 1 ? " is" : "s are"} blocked`,
      body: `${blockedAnswers.map((b) => b.token).join(", ")} can't read your homepage, so ${blockedAnswers.length === 1 ? "that tool" : "those tools"} can't quote or link to you in answers. If you want customers to find you through AI, allow them.`,
    };
  } else if (blockedTraining.length) {
    summary = {
      tone: "success",
      title: "AI search tools can read your site",
      body: `You block ${blockedTraining.length} AI training crawler${blockedTraining.length === 1 ? "" : "s"}. That's a fair business choice and does not stop AI search tools from finding and quoting you.`,
    };
  } else {
    summary = {
      tone: "success",
      title: "No AI crawler is blocked",
      body: "Every AI crawler we check may read your homepage, for both AI answers and AI training. If you'd rather not feed training, use the snippet below.",
    };
  }

  return {
    robotsUrl: input.robotsUrl,
    robotsStatus: input.robotsStatus,
    robotsFound: robots.fetched,
    blocksEveryone: robots.blocksEveryone,
    answers,
    training,
    pageChecked,
    pageStatus: input.pageStatus,
    signals,
    summary,
    snippets: aiRobotsSnippets(),
  };
}
