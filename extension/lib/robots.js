// AI crawler rules from robots.txt (pure, no I/O). A small RFC 9309 reader that answers one question per
// crawler: may it fetch the homepage ("/")? Mirrors src/lib/audit/ai-bots.ts, which uses robots-parser on
// the server; the extension has no dependencies, so the matching is done here.
import { AI_BOTS } from "./constants.js";

/**
 * @typedef {{ agents: string[]; rules: { allow: boolean; pattern: string }[] }} RobotsGroup
 * @typedef {{ token: string; owner: string; purpose: "search" | "user" | "training"; label: string; allowed: boolean; explicit: boolean }} AiBotRule
 * @typedef {{ fetched: boolean; status: number | null; blocksEveryone: boolean; bots: AiBotRule[] }} RobotsSummary
 */

/** @param {string} text @returns {RobotsGroup[]} */
export function parseRobots(text) {
  /** @type {RobotsGroup[]} */
  const groups = [];
  /** @type {RobotsGroup | null} */
  let current = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (!current) continue;
      if (value === "") continue; // "Disallow:" with no path means nothing is blocked
      current.rules.push({ allow: key === "allow", pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

/** Does a robots.txt path pattern (with * and $) match `path`? @param {string} pattern @param {string} path */
export function patternMatches(pattern, path) {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = body
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${re}${anchored ? "$" : ""}`).test(path);
}

/**
 * Is `path` allowed for `agent`? Groups naming the agent win over `*`; the longest matching rule wins and
 * Allow wins a tie (RFC 9309 §2.2.2).
 * @param {RobotsGroup[]} groups @param {string} agent @param {string} [path]
 */
export function isAllowed(groups, agent, path = "/") {
  const name = agent.toLowerCase();
  let chosen = groups.filter((g) => g.agents.includes(name));
  if (!chosen.length) chosen = groups.filter((g) => g.agents.includes("*"));
  let best = { len: -1, allow: true };
  for (const g of chosen) {
    for (const r of g.rules) {
      if (!patternMatches(r.pattern, path)) continue;
      const len = r.pattern.length;
      if (len > best.len || (len === best.len && r.allow)) best = { len, allow: r.allow };
    }
  }
  return best.allow;
}

/**
 * Per-bot homepage access from a fetched robots.txt. A missing or unreadable file means no restrictions.
 * @param {string | null} text @param {number | null} status @returns {RobotsSummary}
 */
export function aiBotRules(text, status) {
  const fetched = text !== null && status !== null && status >= 200 && status < 300;
  if (!fetched) {
    return { fetched: false, status, blocksEveryone: false, bots: AI_BOTS.map((b) => ({ ...b, allowed: true, explicit: false })) };
  }
  const groups = parseRobots(text);
  const mentioned = new Set(groups.flatMap((g) => g.agents));
  return {
    fetched: true,
    status,
    blocksEveryone: !isAllowed(groups, "SomeGenericCrawler"),
    bots: AI_BOTS.map((b) => ({ ...b, allowed: isAllowed(groups, b.token), explicit: mentioned.has(b.token.toLowerCase()) })),
  };
}
