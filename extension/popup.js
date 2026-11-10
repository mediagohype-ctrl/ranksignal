// Popup: reads the current tab when the user clicks the toolbar icon (activeTab), then shows the checks.
// Page text is untrusted, so everything is rendered with textContent, never innerHTML.
/* global chrome */
import { collectPage, fetchSiteFiles } from "./lib/extract.js";
import { analyzePage } from "./lib/analyze.js";
import { aiBotRules } from "./lib/robots.js";
import { TOOL_LINKS, freeCheckUrl, toolUrl } from "./lib/constants.js";

const SECTIONS = [
  { id: "basics", title: "Google basics" },
  { id: "headings", title: "Headings" },
  { id: "content", title: "Content and links" },
  { id: "sharing", title: "Structured data and sharing" },
  { id: "ai", title: "AI readiness" },
];
const STATUS_TEXT = { good: "Good", warn: "Improve", bad: "Problem", info: "Note" };
const STATUS_ICON = { good: "✓", warn: "!", bad: "✕", info: "i" };

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = String(v);
    else if (k === "text") node.textContent = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function renderToolLinks() {
  const list = $("tool-links");
  for (const key of ["meta", "headings", "schema", "aiCrawlers", "llms"]) {
    const t = TOOL_LINKS[key];
    list.append(el("li", {}, el("a", { href: toolUrl(t.path), target: "_blank", rel: "noopener", text: t.label })));
  }
}

function showMessage(text) {
  const main = $("main");
  main.replaceChildren(el("p", { class: "status", text }));
  main.setAttribute("aria-busy", "false");
}

function checkRow(c) {
  const tool = c.tool ? TOOL_LINKS[c.tool] : null;
  return el(
    "li",
    { class: `check check-${c.status}` },
    el("span", { class: "badge", "aria-hidden": "true", text: STATUS_ICON[c.status] }),
    el(
      "div",
      { class: "check-body" },
      el("p", { class: "check-label" }, el("span", { class: "sr-only", text: `${STATUS_TEXT[c.status]}: ` }), c.label),
      c.value ? el("p", { class: "check-value", text: c.value.length > 220 ? `${c.value.slice(0, 219)}…` : c.value }) : null,
      el("p", { class: "check-msg", text: c.message }),
      tool && c.status !== "good" && c.status !== "info"
        ? el("a", { class: "check-tool", href: toolUrl(tool.path), target: "_blank", rel: "noopener", text: `Check deeper: ${tool.label}` })
        : null,
    ),
  );
}

function outlineBlock(outline) {
  if (!outline.length) return el("p", { class: "muted small", text: "No headings found." });
  const problems = outline.filter((o) => o.problem).length;
  const details = el("details", { class: "outline" });
  details.append(
    el("summary", { text: `Heading outline: ${outline.length} ${outline.length === 1 ? "heading" : "headings"}${problems ? `, ${problems} with problems` : ""}` }),
  );
  const list = el("ol", { class: "outline-list" });
  for (const o of outline.slice(0, 200)) {
    list.append(
      el(
        "li",
        { class: o.problem ? "outline-item has-problem" : "outline-item", style: `--lvl:${o.level - 1}` },
        el("span", { class: "tag", text: `H${o.level}` }),
        el("span", { class: "outline-text", text: o.text || "(empty)" }),
        o.problem ? el("span", { class: "outline-problem", text: o.problem }) : null,
      ),
    );
  }
  details.append(list);
  return details;
}

function render(result) {
  const main = $("main");
  const { good, warn, bad } = result.summary;
  const summary = el(
    "div",
    { class: "summary", role: "group", "aria-label": "Summary" },
    el("span", { class: "pill pill-bad", text: `${bad} ${bad === 1 ? "problem" : "problems"}` }),
    el("span", { class: "pill pill-warn", text: `${warn} to improve` }),
    el("span", { class: "pill pill-good", text: `${good} good` }),
  );
  const parts = [summary];
  for (const s of SECTIONS) {
    const checks = result.checks.filter((c) => c.section === s.id);
    const section = el("section", { class: "card", "aria-labelledby": `sec-${s.id}` }, el("h2", { id: `sec-${s.id}`, text: s.title }));
    const list = el("ul", { class: "checks" });
    // Problems first, then improvements, then the rest.
    const order = { bad: 0, warn: 1, good: 2, info: 3 };
    for (const c of [...checks].sort((a, b) => order[a.status] - order[b.status])) list.append(checkRow(c));
    section.append(list);
    if (s.id === "headings") section.append(outlineBlock(result.outline));
    parts.push(section);
  }
  main.replaceChildren(...parts);
  main.setAttribute("aria-busy", "false");
}

async function main() {
  renderToolLinks();
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    tab = null;
  }
  const url = tab && tab.url ? tab.url : "";
  if (!tab || !/^https?:\/\//i.test(url)) {
    $("page-host").textContent = "No web page open";
    showMessage("Open a website page (one that starts with http or https) and click the MyWebRank icon again.");
    return;
  }
  const host = new URL(url).host;
  $("page-host").textContent = host;
  /** @type {HTMLAnchorElement} */ ($("full-check")).href = freeCheckUrl(url);

  try {
    const target = { tabId: /** @type {number} */ (tab.id) };
    const [pageRes, filesRes] = await Promise.all([
      chrome.scripting.executeScript({ target, func: collectPage, args: [null, null] }),
      chrome.scripting.executeScript({ target, func: fetchSiteFiles, args: [null] }).catch(() => null),
    ]);
    const facts = pageRes && pageRes[0] ? pageRes[0].result : null;
    if (!facts) throw new Error("no result");
    const files = filesRes && filesRes[0] ? filesRes[0].result : null;
    const robots = files ? aiBotRules(files.robots.text, files.robots.status) : null;
    render(analyzePage(facts, { robots, llms: files ? files.llms : null }));
  } catch {
    showMessage(
      "We couldn't read this page. Browsers don't let extensions read some pages (such as the Chrome Web Store, browser settings or PDF files). Try another page, or run the full free check.",
    );
  }
}

main();
