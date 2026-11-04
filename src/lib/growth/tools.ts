// Free mini tools (brief §9 / Phase 4). Pure builders shared by the client pages and tests; no DB, no LLM.

export const TOOL_NAMES = ["ai-mention-checker", "faq-markup-maker", "ai-guide-file-maker"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export function isToolName(v: unknown): v is ToolName {
  return typeof v === "string" && (TOOL_NAMES as readonly string[]).includes(v);
}

/** Lead.source for a tool's email box. */
export function toolLeadSource(tool: ToolName): string {
  return `tool:${tool}`;
}

// ---------------------------------------------------------------------------------------------- FAQ (FAQPage JSON-LD)

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_MAX_ITEMS = 30;
const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** schema.org FAQPage object for the filled-in questions (empty rows skipped). */
export function buildFaqJsonLd(items: FaqItem[]): Record<string, unknown> | null {
  const rows = items
    .map((i) => ({ q: clean(i.question ?? "", 300), a: clean(i.answer ?? "", 2000) }))
    .filter((i) => i.q && i.a)
    .slice(0, FAQ_MAX_ITEMS);
  if (rows.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: rows.map((r) => ({ "@type": "Question", name: r.q, acceptedAnswer: { "@type": "Answer", text: r.a } })),
  };
}

/** Ready-to-paste <script> tag. "<" is escaped so an answer can never close the script element. */
export function faqScriptTag(items: FaqItem[]): string | null {
  const data = buildFaqJsonLd(items);
  if (!data) return null;
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

// ---------------------------------------------------------------------------------------------- AI guide file (llms.txt)

export interface GuideLink {
  title: string;
  url: string;
  note?: string;
}

export interface GuideInput {
  businessName: string;
  summary: string;
  details?: string;
  links: GuideLink[];
  contact?: string;
}

const oneLine = (s: string | undefined, max: number) => (s ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
/** Markdown link text must not break the [title](url) syntax. */
const linkText = (s: string) => oneLine(s, 120).replace(/[[\]]/g, "");

/** Absolute http(s) URL or null (anything else is dropped from the file). */
export function safeGuideUrl(raw: string): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/[()\s]/g, encodeURIComponent);
  } catch {
    return null;
  }
}

/** The llms.txt file (llmstxt.org format): # name, > summary, details, ## sections of links. */
export function buildAiGuideFile(i: GuideInput): string {
  const name = oneLine(i.businessName, 120) || "Our business";
  const lines: string[] = [`# ${name}`, ""];
  const summary = oneLine(i.summary, 500);
  if (summary) lines.push(`> ${summary}`, "");
  const details = (i.details ?? "").replace(/\r\n/g, "\n").trim().slice(0, 3000);
  if (details) lines.push(details.replace(/^#/gm, "\\#"), "");
  const links = i.links
    .map((l) => ({ title: linkText(l.title), url: safeGuideUrl(l.url), note: oneLine(l.note, 200) }))
    .filter((l): l is { title: string; url: string; note: string } => !!l.title && !!l.url)
    .slice(0, 50);
  if (links.length) {
    lines.push("## Main pages", "");
    for (const l of links) lines.push(`- [${l.title}](${l.url})${l.note ? `: ${l.note}` : ""}`);
    lines.push("");
  }
  const contact = oneLine(i.contact, 300);
  if (contact) lines.push("## Contact", "", contact, "");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
