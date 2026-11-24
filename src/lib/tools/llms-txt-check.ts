// llms.txt checker: validates an AI guide file against the llmstxt.org format and returns a short, plain-words result
// list (one line per check, each with a next step). Pure: runs in the browser on pasted text and in tests; the API route
// /api/public/tools/llms-txt-checker only fetches the file.
//
// The format (https://llmstxt.org): an H1 "# Name" first, an optional "> summary" blockquote, optional free text, then
// "## Section" headings each holding a list of links "- [Title](https://url): optional note".

/** Largest file we fetch or check (characters). llms.txt files are meant to be short. */
export const LLMS_INPUT_MAX_CHARS = 500 * 1024;
/** Above this size we suggest trimming: AI tools read the file in one go. */
export const LLMS_LONG_BYTES = 100 * 1024;

export type CheckLevel = "ok" | "warn" | "error";

export interface CheckItem {
  id: string;
  level: CheckLevel;
  /** What we found, one line. */
  title: string;
  /** The next step, one line. */
  fix: string;
}

export interface LlmsCheckResult {
  items: CheckItem[];
  errors: number;
  warnings: number;
  name: string | null;
  sections: number;
  links: number;
  bytes: number;
}

/** A link list item: "- [Title](url)" with an optional ": note". */
const LINK_ITEM = /^[-*+]\s+\[([^\]]*)\]\(\s*([^)\s]*)\s*\)\s*(?::\s*(.*))?$/;
const LIST_ITEM = /^[-*+]\s+/;

function lineList(nums: number[]): string {
  const shown = nums.slice(0, 5).join(", ");
  return nums.length > 5 ? `lines ${shown} and ${nums.length - 5} more` : nums.length === 1 ? `line ${shown}` : `lines ${shown}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** True when the text looks like a web page, a binary file or anything else that is not plain Markdown text. */
export function looksLikeNonText(text: string): "html" | "binary" | null {
  if (/^\s*<(!doctype html|html|head|body)\b/i.test(text)) return "html";
  // NUL bytes or a high share of control characters mean a binary file (image, PDF, zip).
  const sample = text.slice(0, 4096);
  if (sample.includes("\u0000")) return "binary";
  const controls = (sample.match(/[\u0001-\u0008\u000e-\u001f�]/g) ?? []).length;
  if (sample.length > 0 && controls / sample.length > 0.05) return "binary";
  return null;
}

export function checkLlmsTxt(input: string): LlmsCheckResult {
  const text = input.replace(/^﻿/, "");
  const bytes = byteLength(text);
  const items: CheckItem[] = [];
  let name: string | null = null;
  const sections: { title: string; line: number; links: number; items: number }[] = [];
  let linkCount = 0;
  const out = (): LlmsCheckResult => ({
    items,
    errors: items.filter((i) => i.level === "error").length,
    warnings: items.filter((i) => i.level === "warn").length,
    name,
    sections: sections.length,
    links: linkCount,
    bytes,
  });

  if (text.trim() === "") {
    items.push({ id: "empty", level: "error", title: "The file is empty.", fix: "Use the Create llms.txt tab to make one, then upload it to your website." });
    return out();
  }
  const nonText = looksLikeNonText(text);
  if (nonText) {
    items.push({
      id: "non-text",
      level: "error",
      title: nonText === "html" ? "This is a web page, not an llms.txt file." : "This is not a plain text file.",
      fix:
        nonText === "html"
          ? "Upload a plain text file named llms.txt to the main folder of your website, so it opens as text, not as a page."
          : "Save the file as plain text (UTF-8) named llms.txt, not as a Word file, PDF or image.",
    });
    return out();
  }

  const lines = text.split(/\r\n|\r|\n/);
  const h1Lines: number[] = [];
  let firstContent = -1; // index of the first non-empty line
  let summaryFound = false;
  const badLinks: number[] = [];
  const plainItems: number[] = [];
  const relative: number[] = [];
  const badUrls: number[] = [];
  const insecure: number[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    const n = i + 1;
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence || line === "") continue;
    if (firstContent === -1) firstContent = i;

    if (/^#(?!#)/.test(line)) {
      h1Lines.push(n);
      if (h1Lines.length === 1) name = line.replace(/^#\s*/, "").trim() || null;
      continue;
    }
    if (/^##(?!#)/.test(line)) {
      sections.push({ title: line.replace(/^##\s*/, "").trim(), line: n, links: 0, items: 0 });
      continue;
    }
    if (line.startsWith(">")) {
      // The summary blockquote counts when it comes right after the H1, before any section.
      if (h1Lines.length > 0 && sections.length === 0) summaryFound = true;
      continue;
    }
    if (!LIST_ITEM.test(line)) continue;

    const section = sections[sections.length - 1];
    if (section) section.items++;
    const m = LINK_ITEM.exec(line);
    if (!m) {
      // A bullet that tries to be a link but is broken, or any plain bullet inside a section (sections hold links).
      if (/\[|\]\(|https?:\/\//i.test(line)) badLinks.push(n);
      else if (section) plainItems.push(n);
      continue;
    }
    const [, title, url] = m;
    if (!title.trim() || !url) {
      badLinks.push(n);
      continue;
    }
    linkCount++;
    if (section) section.links++;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      relative.push(n);
      continue;
    }
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      parsed = null;
    }
    if (!parsed || !/^https?:$/.test(parsed.protocol) || !parsed.hostname) badUrls.push(n);
    else if (parsed.protocol === "http:") insecure.push(n);
  }

  // 1. Title (H1) on the first line.
  if (h1Lines.length === 0) {
    items.push({
      id: "h1-missing",
      level: "error",
      title: "No title line. The file must start with # and your business or website name.",
      fix: "Add a first line like: # Sharma Sweets",
    });
  } else if (firstContent !== -1 && h1Lines[0] !== firstContent + 1) {
    items.push({
      id: "h1-not-first",
      level: "error",
      title: `The title line (# ${name ?? "…"}) is on line ${h1Lines[0]}, not at the top.`,
      fix: "Move the line that starts with a single # to the very first line of the file.",
    });
  } else if (!name) {
    items.push({ id: "h1-empty", level: "error", title: "The title line has no name after the #.", fix: "Write your business or website name after the #, for example: # Sharma Sweets" });
  } else {
    items.push({ id: "h1", level: "ok", title: `Title line found: ${name}.`, fix: "Nothing to change." });
  }
  if (h1Lines.length > 1) {
    items.push({
      id: "h1-multiple",
      level: "error",
      title: `${h1Lines.length} title lines (single #) on ${lineList(h1Lines)}. Only one is allowed.`,
      fix: "Keep the first one. Change the others to section headings that start with ##.",
    });
  }

  // 2. Summary blockquote (optional but recommended).
  items.push(
    summaryFound
      ? { id: "summary", level: "ok", title: "One-line summary found (the line starting with >).", fix: "Nothing to change." }
      : {
          id: "summary-missing",
          level: "warn",
          title: "No one-line summary under the title.",
          fix: "Add a line starting with > that says what you do, for whom and where, right below the title.",
        },
  );

  // 3. Sections.
  if (sections.length === 0) {
    items.push({
      id: "sections-missing",
      level: "warn",
      title: "No sections. AI tools look for ## headings with lists of your pages.",
      fix: "Add a heading like ## Main pages, then list your pages under it.",
    });
  } else {
    const empty = sections.filter((s) => s.links === 0);
    if (empty.length) {
      items.push({
        id: "sections-empty",
        level: "warn",
        title: `${plural(empty.length, "section has", "sections have")} no links: ${empty.map((s) => `"${s.title || "untitled"}" (line ${s.line})`).slice(0, 5).join(", ")}.`,
        fix: "Add at least one link under each ## heading, or remove the empty heading.",
      });
    }
    const untitled = sections.filter((s) => !s.title);
    if (untitled.length) {
      items.push({
        id: "sections-untitled",
        level: "warn",
        title: `${plural(untitled.length, "section heading has", "section headings have")} no name (${lineList(untitled.map((s) => s.line))}).`,
        fix: "Write a short name after ##, such as ## Services.",
      });
    }
    if (empty.length < sections.length) {
      items.push({ id: "sections", level: "ok", title: `${plural(sections.length, "section", "sections")} found.`, fix: "Nothing to change." });
    }
  }

  // 4. Links.
  if (badLinks.length) {
    items.push({
      id: "links-malformed",
      level: "error",
      title: `${plural(badLinks.length, "link is", "links are")} written wrongly (${lineList(badLinks)}).`,
      fix: "Write each link as: - [Page name](https://yoursite.com/page): short note",
    });
  }
  if (plainItems.length) {
    items.push({
      id: "links-plain",
      level: "warn",
      title: `${plural(plainItems.length, "list item has", "list items have")} no link (${lineList(plainItems)}).`,
      fix: "Lists under ## headings should be links. Turn each into - [Page name](https://yoursite.com/page), or move it above the first ##.",
    });
  }
  if (relative.length) {
    items.push({
      id: "links-relative",
      level: "error",
      title: `${plural(relative.length, "link is", "links are")} missing https:// and your domain (${lineList(relative)}).`,
      fix: "Use full addresses, for example https://yoursite.com/services instead of /services.",
    });
  }
  if (badUrls.length) {
    items.push({
      id: "links-bad-url",
      level: "error",
      title: `${plural(badUrls.length, "link doesn't", "links don't")} point to a web address (${lineList(badUrls)}).`,
      fix: "Each link should start with https:// and point to a page on your website.",
    });
  }
  if (insecure.length) {
    items.push({
      id: "links-http",
      level: "warn",
      title: `${plural(insecure.length, "link uses", "links use")} http:// instead of https:// (${lineList(insecure)}).`,
      fix: "Change them to https:// if your website has a secure address.",
    });
  }
  if (linkCount === 0 && badLinks.length === 0) {
    items.push({
      id: "links-none",
      level: "warn",
      title: "No page links found.",
      fix: "List your most useful pages, one per line: - [Services](https://yoursite.com/services): what you offer",
    });
  } else if (linkCount > 0 && badLinks.length + relative.length + badUrls.length === 0) {
    items.push({ id: "links", level: "ok", title: `${plural(linkCount, "link is", "links are")} written correctly.`, fix: "Nothing to change." });
  }

  // 5. Size.
  if (bytes > LLMS_LONG_BYTES) {
    items.push({
      id: "too-long",
      level: "warn",
      title: `The file is very long (${Math.round(bytes / 1024)} KB). AI tools may stop reading part way.`,
      fix: "Keep it under 100 KB: list only your most useful pages and put extra pages under ## Optional.",
    });
  } else {
    items.push({ id: "size", level: "ok", title: `Short enough for AI tools to read in one go (${(bytes / 1024).toFixed(1)} KB).`, fix: "Nothing to change." });
  }

  return out();
}

/** A ready-made file in the llmstxt.org format, used by "Use an example" and in tests. */
export const LLMS_TXT_EXAMPLE = [
  "# Sharma Sweets",
  "",
  "> Fresh Indian sweets and snacks in Jaipur since 1985, with home delivery across the city.",
  "",
  "Open every day from 9 am to 9 pm. Orders for weddings and festivals need two days' notice.",
  "",
  "## Main pages",
  "",
  "- [Home](https://sharmasweets.example/): who we are and where to find us",
  "- [Menu and prices](https://sharmasweets.example/menu): every sweet and snack with today's price",
  "- [Home delivery](https://sharmasweets.example/delivery): areas we deliver to and charges",
  "",
  "## Optional",
  "",
  "- [Our story](https://sharmasweets.example/about)",
  "",
].join("\n");

/* -------------------------------------------------------------------------------------------- fetch result */

export interface LlmsFetchResult {
  site: string;
  llmsUrl: string;
  finalUrl: string | null;
  status: number | null;
  contentType: string | null;
  /** File text when the server answered 2xx with text; null otherwise. Untrusted. */
  text: string | null;
  /** Why the file could not be read, in plain English with a next step. */
  error: string | null;
}

/** Plain-words explanation of a fetch result that has no checkable text (missing file, server error). */
export function llmsFetchNote(r: LlmsFetchResult): { tone: "success" | "warning" | "danger"; title: string; body: string } | null {
  if (r.error) return { tone: "danger", title: "We couldn't read your llms.txt", body: r.error };
  if (r.status === null) return null;
  if (r.status === 404 || r.status === 410)
    return {
      tone: "warning",
      title: "Your website has no llms.txt file yet",
      body: "Use the Create llms.txt tab to make one, then upload it to the main folder of your website.",
    };
  if (r.status >= 400 && r.status < 500)
    return { tone: "warning", title: `Your website refused the request (error ${r.status})`, body: "Check that yoursite.com/llms.txt opens in a private browser window, then try again." };
  if (r.status >= 500) return { tone: "danger", title: `Your website had a server error (error ${r.status})`, body: "Try again in a few minutes. If it keeps happening, ask your web person or host." };
  if (r.text !== null) return { tone: "success", title: "We found your llms.txt", body: "Here is what we checked." };
  return null;
}
