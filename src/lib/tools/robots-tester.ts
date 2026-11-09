// Robots.txt tester (pure, browser-safe): a line-by-line lint of a robots.txt file and an Allowed/Blocked test for one
// crawler + path. Matching uses robots-parser (the same library as our crawler), which follows RFC 9309: the group for
// the crawler's product token (else `*`), then the longest matching Allow/Disallow pattern, with Allow winning a tie.
import robotsParser from "robots-parser";
import { AI_BOTS } from "@/lib/audit/ai-bots";

/** Google reads only the first 500 KiB of a robots.txt file and ignores the rest. */
export const ROBOTS_GOOGLE_MAX_BYTES = 500 * 1024;
/** Largest robots.txt text we accept (pasted or fetched). */
export const ROBOTS_INPUT_MAX_CHARS = 600 * 1024;

export interface TesterCrawler {
  token: string;
  owner: string;
  label: string;
}

export const TESTER_CRAWLERS: TesterCrawler[] = [
  { token: "Googlebot", owner: "Google", label: "Google Search" },
  { token: "Bingbot", owner: "Microsoft", label: "Bing search" },
  ...AI_BOTS.map((b) => ({ token: b.token, owner: b.owner, label: b.label })),
  { token: "*", owner: "", label: "Any other crawler (User-agent: *)" },
];

export type RobotsLineKind =
  | "user-agent"
  | "allow"
  | "disallow"
  | "sitemap"
  | "crawl-delay"
  | "other"
  | "comment"
  | "blank"
  | "unknown"
  | "invalid";

export type ProblemLevel = "error" | "warning" | "info";

export interface RobotsLine {
  /** 1-based line number (same numbering robots-parser uses). */
  n: number;
  text: string;
  kind: RobotsLineKind;
  directive?: string;
  value?: string;
  problem?: { level: ProblemLevel; message: string };
}

export interface RobotsRule {
  line: number;
  allow: boolean;
  pattern: string;
}

export interface RobotsGroup {
  agents: string[];
  startLine: number;
  rules: RobotsRule[];
}

export interface RobotsLint {
  lines: RobotsLine[];
  groups: RobotsGroup[];
  sitemaps: { line: number; url: string; valid: boolean }[];
  errors: number;
  warnings: number;
  bytes: number;
  /** Larger than Google's 500 KiB limit: rules past that point are ignored by Google. */
  overGoogleLimit: boolean;
  /** `User-agent: *` with `Disallow: /` — every crawler without its own group is blocked from the whole site. */
  blocksEveryone: boolean;
}

const TYPOS: Record<string, string> = {
  disalow: "Disallow",
  dissallow: "Disallow",
  dissalow: "Disallow",
  disallows: "Disallow",
  "dis-allow": "Disallow",
  alow: "Allow",
  allows: "Allow",
  useragent: "User-agent",
  "user agent": "User-agent",
  "user-agents": "User-agent",
  "user_agent": "User-agent",
  "site-map": "Sitemap",
  sitemaps: "Sitemap",
  "site map": "Sitemap",
};

const OTHER_KNOWN: Record<string, { level: ProblemLevel; message: string }> = {
  host: { level: "info", message: "Only Yandex used Host. Google and most other crawlers ignore this line." },
  "clean-param": { level: "info", message: "Clean-param is a Yandex-only rule. Google ignores it." },
  noindex: {
    level: "warning",
    message: "Google stopped reading noindex in robots.txt in 2019. Use a robots meta tag or an X-Robots-Tag header instead.",
  },
  "request-rate": { level: "info", message: "Request-rate is not part of the standard. Most crawlers ignore it." },
  "visit-time": { level: "info", message: "Visit-time is not part of the standard. Most crawlers ignore it." },
};

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Line-by-line check of a robots.txt file: syntax problems, groups, rules and Sitemap lines. */
export function lintRobots(input: string): RobotsLint {
  const text = input.replace(/^﻿/, "");
  const raw = text.split(/\r\n|\r|\n/);
  if (raw.length > 1 && raw[raw.length - 1] === "") raw.pop();
  const lines: RobotsLine[] = [];
  const groups: RobotsGroup[] = [];
  const sitemaps: RobotsLint["sitemaps"] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  raw.forEach((original, i) => {
    const n = i + 1;
    const hash = original.indexOf("#");
    const body = (hash >= 0 ? original.slice(0, hash) : original).trim();
    if (!body) {
      lines.push({ n, text: original, kind: hash >= 0 ? "comment" : "blank" });
      return;
    }
    const colon = body.indexOf(":");
    if (colon < 0) {
      lines.push({ n, text: original, kind: "invalid", problem: { level: "error", message: "This line has no colon (:), so crawlers ignore it. Write it as Directive: value." } });
      return;
    }
    const directive = body.slice(0, colon).trim();
    const value = body.slice(colon + 1).trim();
    const key = directive.toLowerCase();
    const line: RobotsLine = { n, text: original, kind: "unknown", directive, value };

    if (key === "user-agent") {
      line.kind = "user-agent";
      if (!value) line.problem = { level: "error", message: "User-agent needs a crawler name, or * for all crawlers." };
      else {
        if (!lastWasAgent || !current) {
          current = { agents: [], startLine: n, rules: [] };
          groups.push(current);
        }
        current.agents.push(value);
      }
      lastWasAgent = true;
      lines.push(line);
      return;
    }
    lastWasAgent = false;

    if (key === "allow" || key === "disallow") {
      line.kind = key;
      if (!current) {
        line.problem = { level: "error", message: "This rule is not under a User-agent line, so crawlers ignore it. Put a User-agent line above it." };
      } else if (!value) {
        if (key === "disallow") line.problem = { level: "info", message: "An empty Disallow blocks nothing: this group may read the whole site." };
        else line.problem = { level: "warning", message: "An empty Allow does nothing. Remove it or add a path." };
      } else {
        if (!value.startsWith("/") && !value.startsWith("*")) {
          line.problem = { level: "warning", message: "Paths should start with a slash (/). Without it this rule may never match." };
        }
        current.rules.push({ line: n, allow: key === "allow", pattern: value });
      }
    } else if (key === "sitemap") {
      line.kind = "sitemap";
      const valid = /^https?:\/\/[^\s/]+/i.test(value) && isUrl(value);
      sitemaps.push({ line: n, url: value, valid });
      if (!valid) line.problem = { level: "error", message: "Sitemap must be a full address, for example https://example.com/sitemap.xml." };
    } else if (key === "crawl-delay") {
      line.kind = "crawl-delay";
      line.problem = !/^\d+(\.\d+)?$/.test(value)
        ? { level: "warning", message: "Crawl-delay should be a number of seconds." }
        : { level: "info", message: "Google ignores Crawl-delay. Bing and some other crawlers use it." };
      if (!current) line.problem = { level: "warning", message: "Crawl-delay is not under a User-agent line, so crawlers ignore it." };
    } else if (OTHER_KNOWN[key]) {
      line.kind = "other";
      line.problem = OTHER_KNOWN[key];
    } else {
      const fix = TYPOS[key];
      line.problem = fix
        ? { level: "error", message: `Unknown rule "${directive}". Did you mean "${fix}"? Crawlers ignore this line as written.` }
        : { level: "warning", message: `"${directive}" is not a robots.txt rule. Crawlers ignore this line.` };
    }
    lines.push(line);
  });

  const bytes = byteLength(text);
  const star = groups.filter((g) => g.agents.some((a) => a === "*"));
  const blocksEveryone =
    star.length > 0 && testRules(star.flatMap((g) => g.rules), "/")?.allow === false;
  return {
    lines,
    groups,
    sitemaps,
    errors: lines.filter((l) => l.problem?.level === "error").length,
    warnings: lines.filter((l) => l.problem?.level === "warning").length,
    bytes,
    overGoogleLimit: bytes > ROBOTS_GOOGLE_MAX_BYTES,
    blocksEveryone,
  };
}

function isUrl(s: string): boolean {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

/** Evaluate a rule list for one path with the same matcher as the tester (used for the "blocks everyone" summary). */
function testRules(rules: RobotsRule[], path: string): RobotsRule | null {
  const body = rules.map((r) => `${r.allow ? "Allow" : "Disallow"}: ${r.pattern}`).join("\n");
  const robot = robotsParser("https://robots.test/robots.txt", `User-agent: *\n${body}`);
  const ln = robot.getMatchingLineNumber(`https://robots.test${path}`, "*");
  return ln > 1 ? rules[ln - 2] : null;
}

/** Turn what a person typed ("/shop?x=1", "shop", "https://site.com/shop") into a path + query. Null if unusable. */
export function toRobotsPath(input: string): string | null {
  const s = input.trim();
  if (!s) return "/";
  if (s.length > 2000) return null;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      return `${u.pathname || "/"}${u.search}`;
    } catch {
      return null;
    }
  }
  if (/\s/.test(s)) return null;
  return s.startsWith("/") ? s : `/${s}`;
}

export interface RobotsTestResult {
  token: string;
  path: string;
  allowed: boolean;
  /** Line of the deciding Allow/Disallow rule, or null when no rule matched (allowed by default). */
  matchedLine: number | null;
  matchedRule: string | null;
  /** The User-agent value whose group applied, "*" for the catch-all group, or null when no group applies. */
  group: string | null;
  explanation: string;
}

/**
 * Is `path` allowed for crawler `token` under this robots.txt? RFC 9309: the crawler obeys the group(s) naming
 * its product token (case-insensitive), otherwise the `*` group; within it the longest matching pattern wins and
 * Allow wins a tie. /robots.txt itself is always allowed.
 */
export function testRobotsPath(text: string, token: string, pathInput: string): RobotsTestResult | null {
  return createRobotsTester(text)(token, pathInput);
}

/** Parse once, test many times (the UI re-tests every crawler on each keystroke). */
export function createRobotsTester(text: string, lintResult?: RobotsLint): (token: string, pathInput: string) => RobotsTestResult | null {
  const origin = "https://robots.test";
  const clean = text.replace(/^﻿/, "");
  const lint = lintResult ?? lintRobots(clean);
  const robot = robotsParser(`${origin}/robots.txt`, clean);
  return (token, pathInput) => testWith(robot, lint, origin, token, pathInput);
}

function testWith(
  robot: ReturnType<typeof robotsParser>,
  lint: RobotsLint,
  origin: string,
  token: string,
  pathInput: string,
): RobotsTestResult | null {
  const path = toRobotsPath(pathInput);
  if (!path) return null;
  const tokenKey = token.toLowerCase();
  const own = lint.groups.some((g) => g.agents.some((a) => agentKey(a) === tokenKey));
  const star = lint.groups.some((g) => g.agents.some((a) => a === "*"));
  const group = own ? token : star ? "*" : null;

  if (path === "/robots.txt") {
    return { token, path, allowed: true, matchedLine: null, matchedRule: null, group, explanation: "The robots.txt file itself is always allowed." };
  }
  const url = `${origin}${path}`;
  const allowed = robot.isAllowed(url, token) !== false;
  const ln = robot.getMatchingLineNumber(url, token);
  const matched = ln > 0 ? lint.lines.find((l) => l.n === ln) : undefined;
  const matchedRule = matched ? `${matched.directive}: ${matched.value}` : null;
  const who = token === "*" ? "Crawlers without their own group" : token;
  let explanation: string;
  if (!group) explanation = `No group in this file applies to ${who}, so everything is allowed.`;
  else if (!matched)
    explanation = `${who} ${group === "*" ? "follows the User-agent: * group" : "has its own group"}, but no rule in it matches ${path}, so it is allowed.`;
  else
    explanation = `${who} ${group === "*" ? "follows the User-agent: * group" : "has its own group"}. The longest matching rule is line ${ln} (${matchedRule}), so ${path} is ${allowed ? "allowed" : "blocked"}.`;
  return { token, path, allowed, matchedLine: matched ? ln : null, matchedRule, group, explanation };
}

/** Same normalisation robots-parser applies to User-agent values ("Googlebot/2.1" → "googlebot"). */
function agentKey(agent: string): string {
  const a = agent.toLowerCase();
  const i = a.indexOf("/");
  return (i >= 0 ? a.slice(0, i) : a).trim();
}

/** What POST /api/public/tools/robots-txt-tester returns (the lint and tests then run in the browser). */
export interface RobotsFetchResult {
  site: string;
  robotsUrl: string;
  finalUrl: string | null;
  status: number | null;
  redirectChain: string[];
  contentType: string | null;
  /** File text when the server answered 2xx; null otherwise. Untrusted. */
  text: string | null;
  /** Why the file could not be read at all (network/timeout/too large), in plain English. */
  error: string | null;
}

export interface RobotsFetchNote {
  tone: "success" | "info" | "warning" | "danger";
  title: string;
  body: string;
}

/** Plain-English meaning of the robots.txt HTTP result, following Google's documented handling. */
export function robotsStatusNote(status: number | null, redirects: number): RobotsFetchNote {
  if (status === null) {
    return {
      tone: "warning",
      title: "We couldn't reach your robots.txt",
      body: "The request failed or timed out. If Google has the same trouble, it may slow down or pause crawling. Check that your site loads and try again.",
    };
  }
  if (status >= 200 && status < 300) {
    return redirects > 0
      ? { tone: "info", title: `Found after ${redirects} redirect${redirects === 1 ? "" : "s"}`, body: "Google follows at least five redirects for robots.txt, so this works. Serving it directly at /robots.txt is still cleaner." }
      : { tone: "success", title: "Found your robots.txt", body: "The file loaded normally (HTTP " + status + ")." };
  }
  if (status === 429 || status >= 500) {
    return {
      tone: "danger",
      title: `Server error (HTTP ${status})`,
      body: "Google treats a robots.txt server error as if the whole site were blocked and pauses crawling. If it lasts, Google falls back to its last good copy for up to 30 days, then may crawl as if there were no rules. Fix this first.",
    };
  }
  if (status >= 400) {
    return {
      tone: "info",
      title: `No robots.txt (HTTP ${status})`,
      body: "That's fine. With no robots.txt, crawlers may read every page. Add one only if you want to block something or list your sitemap.",
    };
  }
  return { tone: "warning", title: `Unexpected answer (HTTP ${status})`, body: "Your server gave an unusual response for robots.txt. Make sure /robots.txt returns the file with status 200." };
}
