// Minimal, safe Markdown for blog posts (pure; no HTML is ever passed through). Supports:
// ## / ### headings, paragraphs, - / * bullets, 1. numbered lists, > quotes, ``` code blocks, | tables |,
// ![alt](url) images on their own line, and inline **bold**, *italic*, `code`, [text](url).

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] };

export type Block =
  | { t: "h2" | "h3"; id: string; text: string; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "quote"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "img"; alt: string; src: string }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] };

/** Only http(s), mailto, site-relative and in-page links/images survive; everything else (javascript: …) becomes "#". */
export function safeHref(href: string): string {
  // Browsers drop tabs/newlines and treat "\" like "/" in URLs, so "/\evil.com" or "/\t/evil.com" would become
  // "//evil.com" (off-site). Strip control characters first and reject a "/" followed by "/" or "\".
  const h = href.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (/^(https?:\/\/|mailto:)/i.test(h) || /^\/(?![/\\])/.test(h) || h.startsWith("#")) return h;
  return "#";
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const LINK = /^\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^`([^`]+)`/))) {
      flush();
      out.push({ t: "code", v: m[1] });
    } else if ((m = rest.match(/^\*\*(.+?)\*\*/))) {
      flush();
      out.push({ t: "strong", c: parseInline(m[1]) });
    } else if ((m = rest.match(/^\*(?!\s)(.+?)\*/)) || (m = rest.match(/^_(?!\s)(.+?)_(?![A-Za-z0-9])/))) {
      flush();
      out.push({ t: "em", c: parseInline(m[1]) });
    } else if ((m = rest.match(LINK))) {
      flush();
      out.push({ t: "link", href: safeHref(m[2]), c: parseInline(m[1]) });
    } else {
      buf += src[i];
      i++;
      continue;
    }
    i += m[0].length;
  }
  flush();
  return out;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

/** URL inside (…), allowing one level of balanced parentheses (Wikipedia-style links). */
const URL_IN_PARENS = String.raw`((?:[^()\s]|\([^()\s]*\))+)`;
const IMG_LINE = new RegExp(String.raw`^!\[([^\]]*)\]\(` + URL_IN_PARENS + String.raw`\)$`);

const isTableStart = (lines: string[], i: number) =>
  lines[i].trim().startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1]);

/** Ids the blog page itself uses; body headings get a suffix instead of colliding with them. */
export const RESERVED_IDS = ["answer", "key-points", "faq", "faq-h", "main"] as const;

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const used = new Map<string, number>(RESERVED_IDS.map((id) => [id, 1]));
  const uniqueId = (text: string) => {
    const base = slugify(text) || "section";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (trimmed.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      i++;
      blocks.push({ t: "code", v: body.join("\n") });
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = trimmed.match(/^(#{2,3})\s+(.+)$/))) {
      const text = m[2].replace(/#+\s*$/, "").trim();
      blocks.push({ t: m[1].length === 2 ? "h2" : "h3", id: uniqueId(text), text, c: parseInline(text) });
      i++;
      continue;
    }
    if ((m = trimmed.match(/^#\s+(.+)$/))) {
      // A single # would be a second H1 on the page (the title is the H1): demote to H2.
      blocks.push({ t: "h2", id: uniqueId(m[1]), text: m[1], c: parseInline(m[1]) });
      i++;
      continue;
    }
    if ((m = trimmed.match(IMG_LINE))) {
      // Images: only https:// or site-relative sources; anything else (data:, //host, javascript:) is dropped
      // rather than rendered as src="#" (which would re-request the page as an image).
      const src = safeHref(m[2]);
      if (/^(https:\/\/|\/(?!\/))/.test(src)) blocks.push({ t: "img", alt: m[1], src });
      i++;
      continue;
    }
    if (isTableStart(lines, i)) {
      const head = cells(trimmed).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]).map(parseInline));
      blocks.push({ t: "table", head, rows });
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(parseInline(lines[i++].trim().replace(/^[-*]\s+/, "")));
      blocks.push({ t: "ul", items });
      continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(parseInline(lines[i++].trim().replace(/^\d+[.)]\s+/, "")));
      blocks.push({ t: "ol", items });
      continue;
    }
    if (trimmed.startsWith(">")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) q.push(lines[i++].trim().replace(/^>\s?/, ""));
      blocks.push({ t: "quote", c: parseInline(q.join(" ")) });
      continue;
    }
    // Paragraph. The first line is ALWAYS consumed, so the parser can never stop advancing (e.g. on a lone "|"
    // line that isn't a table); following lines join until something that starts another block.
    const para: string[] = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|[-*]\s|\d+[.)]\s|>|```)/.test(lines[i].trim()) &&
      !isTableStart(lines, i) &&
      !IMG_LINE.test(lines[i].trim())
    ) {
      para.push(lines[i++].trim());
    }
    blocks.push({ t: "p", c: parseInline(para.join(" ")) });
  }
  return blocks;
}

/** Plain text of inline nodes. */
export function inlineText(c: Inline[]): string {
  return c.map((n) => (n.t === "text" || n.t === "code" ? n.v : inlineText(n.c))).join("");
}

/** Plain text of a whole document (for word counts and llms-full.txt). */
export function plainText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case "h2":
        case "h3":
          return b.text;
        case "p":
        case "quote":
          return inlineText(b.c);
        case "ul":
        case "ol":
          return b.items.map(inlineText).join("\n");
        case "code":
          return b.v;
        case "img":
          return b.alt;
        case "table":
          return [b.head, ...b.rows].map((r) => r.map(inlineText).join(" | ")).join("\n");
      }
    })
    .join("\n\n");
}

export function links(blocks: Block[]): string[] {
  const out: string[] = [];
  const walk = (c: Inline[]) => {
    for (const n of c) {
      if (n.t === "link") out.push(n.href);
      if (n.t === "strong" || n.t === "em" || n.t === "link") walk(n.c);
    }
  };
  for (const b of blocks) {
    if (b.t === "p" || b.t === "quote" || b.t === "h2" || b.t === "h3") walk(b.c);
    if (b.t === "ul" || b.t === "ol") b.items.forEach(walk);
    if (b.t === "table") [b.head, ...b.rows].forEach((r) => r.forEach(walk));
  }
  return out;
}

export const wordCount = (s: string) => (s.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
