// Parses the Markdown that AI tools answer in (headings, lists, tables, bold, links) into a small block tree.
// Pure and dependency-free; rendered by components/app/ai-answers/answer-text.tsx as React elements — never as HTML,
// because provider text is untrusted.

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] };

export type Block =
  | { t: "h"; level: 1 | 2 | 3; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; start: number; items: Inline[][] }
  | { t: "quote"; c: Inline[] }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "hr" };

const TRACKING = /^(utm_[a-z]+|ref|ref_src|fbclid|gclid|mc_[a-z]+)$/i;

/** Only http(s) links survive; tracking parameters (utm_source=openai …) are removed. */
export function cleanHref(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return null;
  }
}

/** "https://www.upwork.com/hire/in/" → "upwork.com" */
export function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

const INLINE_RE = /(\*\*|__)(.+?)\1|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w*])\*(?!\s)([^*]+?)\*(?!\w)|(?<![\w_])_(?!\s)([^_]+?)_(?!\w)|(https?:\/\/[^\s)<>\]]+)/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  const push = (v: string) => {
    if (!v) return;
    const prev = out[out.length - 1];
    if (prev?.t === "text") prev.v += v;
    else out.push({ t: "text", v });
  };
  for (const m of src.matchAll(INLINE_RE)) {
    const i = m.index ?? 0;
    push(src.slice(last, i));
    last = i + m[0].length;
    if (m[2] !== undefined) out.push({ t: "strong", c: parseInline(m[2]) });
    else if (m[3] !== undefined) out.push({ t: "code", v: m[3] });
    else if (m[4] !== undefined) {
      const href = cleanHref(m[5]);
      // "[upwork.com](https://…)" → link; unsafe targets keep only their text.
      if (href) out.push({ t: "link", href, c: parseInline(m[4]) });
      else push(m[4]);
    } else if (m[6] !== undefined) out.push({ t: "em", c: parseInline(m[6]) });
    else if (m[7] !== undefined) out.push({ t: "em", c: parseInline(m[7]) });
    else if (m[8] !== undefined) {
      const trail = /[.,;:!?]+$/.exec(m[8])?.[0] ?? "";
      const href = cleanHref(m[8].slice(0, m[8].length - trail.length));
      if (href) out.push({ t: "link", href, c: [{ t: "text", v: hostOf(href) }] });
      else push(m[8].slice(0, m[8].length - trail.length));
      push(trail);
    }
  }
  push(src.slice(last));
  return out;
}

const cells = (row: string) =>
  row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => parseInline(c.trim()));
const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes("-");
const UL = /^\s*[-*+•]\s+(.*)$/;
const OL = /^\s*(\d{1,3})[.)]\s+(.*)$/;

export function parseAnswer(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join(" ")) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*$/.exec(trimmed);
    if (h) {
      flush();
      blocks.push({ t: "h", level: Math.min(3, h[1].length) as 1 | 2 | 3, c: parseInline(h[2]) });
      continue;
    }
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      flush();
      blocks.push({ t: "hr" });
      continue;
    }
    if (trimmed.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flush();
      const head = cells(trimmed);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      i--;
      blocks.push({ t: "table", head, rows });
      continue;
    }
    if (UL.test(line) || OL.test(line)) {
      flush();
      const ordered = !UL.test(line);
      const start = ordered ? Number(OL.exec(line)![1]) : 1;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = ordered ? OL.exec(l) : UL.exec(l);
        if (m) items.push(parseInline(ordered ? m[2] : m[1]));
        else if (l.trim() && /^\s{2,}/.test(l) && items.length) items[items.length - 1].push({ t: "text", v: " " }, ...parseInline(l.trim()));
        else break;
        i++;
      }
      i--;
      blocks.push(ordered ? { t: "ol", start, items } : { t: "ul", items });
      continue;
    }
    if (trimmed.startsWith(">")) {
      flush();
      blocks.push({ t: "quote", c: parseInline(trimmed.replace(/^>\s?/, "")) });
      continue;
    }
    para.push(trimmed);
  }
  flush();
  return blocks;
}
