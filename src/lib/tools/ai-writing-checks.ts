// Client-safe helpers for the free AI writing tools: input limits, text cleaning and the deterministic
// pass/warn checks shown next to every AI draft. No server-only imports (the tool pages use this in the browser).
import { TITLE_MAX, TITLE_MIN } from "@/lib/audit/rules";
import { DESCRIPTION_TARGET_MAX, DESCRIPTION_TARGET_MIN, FAQ_NOT_STATED } from "./ai-writing-prompts";

/** Hard caps on visitor input (cost control: every run is one paid LLM call). */
export const AI_INPUT_LIMITS = {
  topic: 200,
  keyword: 80,
  brand: 60,
  city: 60,
  cta: 80,
  audience: 80,
  location: 60,
  pageText: 4000,
} as const;

export const FAQ_ANSWER_MIN_WORDS = 40;
export const FAQ_ANSWER_MAX_WORDS = 80;

export type DraftStatus = "pass" | "warn";
export interface DraftCheck {
  text: string;
  length: number;
  status: DraftStatus;
  /** Plain-English reasons for a "warn" (empty when everything passes). */
  notes: string[];
}

/** Collapse whitespace and drop control characters from visitor input. */
export function cleanInput(s: string | undefined | null, max: number): string {
  return (s ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Like cleanInput but keeps paragraph breaks (pasted page text). */
export function cleanMultiline(s: string | undefined | null, max: number): string {
  return (s ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim()
    .slice(0, max);
}

const QUOTE_PAIRS = /^(["'“”‘’«»`]+)([\s\S]*?)(["'“”‘’«»`]+)$/;

/**
 * Normalise one line of model output: strip HTML tags, markdown emphasis/headings/code, list numbering,
 * surrounding quotes, emojis, then collapse whitespace.
 */
export function cleanLine(raw: string): string {
  let s = String(raw ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, "$1")
    .replace(/[*`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/^#{1,6}\s+/, "").replace(/^(?:\d{1,2}[.)]|[-•–]|title\s*\d*:|description\s*\d*:)\s+/i, "");
  for (let i = 0; i < 2; i++) {
    const m = QUOTE_PAIRS.exec(s);
    if (m) s = m[2].trim();
  }
  return s.replace(/\s+/g, " ").trim();
}

export function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Cut text to at most `maxWords`, preferring the last full sentence; otherwise adds an ellipsis. */
export function limitWords(s: string, maxWords: number): string {
  const words = s.trim().split(/\s+/);
  if (words.length <= maxWords) return s.trim();
  const cut = words.slice(0, maxWords).join(" ");
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "), /[.?!]$/.test(cut) ? cut.length - 1 : -1);
  if (end > 0 && countWords(cut.slice(0, end + 1)) >= Math.ceil(maxWords / 2)) return cut.slice(0, end + 1);
  return `${cut.replace(/[,;:\-–—\s]+$/, "")}…`;
}

/** Shorten to `max` characters at a sentence end when one lands at or after `min`; otherwise unchanged. */
export function shortenAtSentence(s: string, min: number, max: number): string {
  if (s.length <= max) return s;
  const head = s.slice(0, max + 1);
  for (let i = head.length - 1; i >= min - 1; i--) {
    if (/[.?!]/.test(head[i]) && (i + 1 === head.length || /\s/.test(head[i + 1] ?? " "))) return head.slice(0, i + 1);
  }
  return s;
}

const CLICKBAIT =
  /(you won'?t believe|shocking|insane|mind[- ]?blowing|jaw[- ]?dropping|unbelievable|secret trick|click here|must[- ]see|best ever|number one|#\s?1\b|!)/i;

export function hasClickbait(s: string): boolean {
  return CLICKBAIT.test(s);
}

/** Words of 5+ letters written in capitals that the visitor didn't type that way (acronyms like SEO are fine). */
export function shoutedWords(s: string, allowed: string[] = []): string[] {
  const ok = new Set(allowed.flatMap((a) => a.split(/\s+/)).filter(Boolean));
  return (s.match(/\b\p{Lu}{5,}\b/gu) ?? []).filter((w) => !ok.has(w));
}

/** True when most of the letters are capitals ("BEST PLUMBER IN PUNE"). */
export function isAllCaps(s: string): boolean {
  const letters = s.match(/\p{L}/gu) ?? [];
  if (letters.length < 8) return false;
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return upper / letters.length > 0.7;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Title checks: length (TITLE_MIN–TITLE_MAX from the audit rules), keyword first, brand last, no clickbait/caps. */
export function evaluateTitle(title: string, o: { keyword: string; brand?: string }): DraftCheck {
  const notes: string[] = [];
  const len = title.length;
  if (len > TITLE_MAX) notes.push(`${len} characters: Google may cut it off. Aim for ${TITLE_MAX} or fewer.`);
  else if (len < TITLE_MIN) notes.push(`Only ${len} characters: add a few words that describe the page.`);
  const t = norm(title);
  const kw = norm(o.keyword);
  if (kw) {
    const at = t.indexOf(kw);
    if (at < 0) {
      const parts = kw.split(" ").filter((w) => w.length > 2);
      if (!parts.length || !parts.every((w) => t.includes(w))) notes.push("Your main keyword is missing.");
      else notes.push("Uses your keyword words, but not as one phrase.");
    } else if (at > 25) notes.push("Move your main keyword closer to the start.");
  }
  const brand = norm(o.brand ?? "");
  if (brand) {
    if (!t.includes(brand)) notes.push("Your brand name is missing.");
    else if (!t.endsWith(brand)) notes.push("Put your brand name at the end.");
  }
  if (hasClickbait(title)) notes.push("Sounds like clickbait. Describe the page plainly.");
  if (isAllCaps(title) || shoutedWords(title, [o.keyword, o.brand ?? ""]).length) notes.push("Avoid words in ALL CAPS.");
  return { text: title, length: len, status: notes.length ? "warn" : "pass", notes };
}

/** Description checks: 120–155 characters, keyword included, no clickbait/caps. */
export function evaluateDescription(desc: string, o: { keyword: string }): DraftCheck {
  const notes: string[] = [];
  const len = desc.length;
  if (len > DESCRIPTION_TARGET_MAX) notes.push(`${len} characters: Google may cut it off. Aim for ${DESCRIPTION_TARGET_MAX} or fewer.`);
  else if (len < DESCRIPTION_TARGET_MIN) notes.push(`Only ${len} characters: add a detail or a reason to click (aim for ${DESCRIPTION_TARGET_MIN}+).`);
  const kw = norm(o.keyword);
  if (kw && !norm(desc).includes(kw)) {
    const parts = kw.split(" ").filter((w) => w.length > 2);
    if (!parts.length || !parts.every((w) => norm(desc).includes(w))) notes.push("Your main keyword is missing.");
  }
  if (hasClickbait(desc)) notes.push("Sounds like clickbait. Say plainly what the page offers.");
  if (isAllCaps(desc) || shoutedWords(desc, [o.keyword]).length) notes.push("Avoid words in ALL CAPS.");
  return { text: desc, length: len, status: notes.length ? "warn" : "pass", notes };
}

export function isNotStated(answer: string): boolean {
  return /not stated on the page/i.test(answer) || answer.trim() === FAQ_NOT_STATED;
}

/** FAQ answer checks shown in the editor: 40–80 words, or a "fill this in" warning for unsupported answers. */
export function evaluateFaqAnswer(answer: string): DraftCheck {
  const notes: string[] = [];
  const words = countWords(answer);
  if (!answer.trim()) notes.push("Write an answer, or remove this question.");
  else if (isNotStated(answer)) notes.push("Your page doesn't answer this yet. Write the real answer before you publish.");
  else if (words < FAQ_ANSWER_MIN_WORDS) notes.push(`${words} words: a fuller answer (40–80 words) helps.`);
  else if (words > FAQ_ANSWER_MAX_WORDS) notes.push(`${words} words: keep it under ${FAQ_ANSWER_MAX_WORDS} so it's easy to quote.`);
  return { text: answer, length: words, status: notes.length ? "warn" : "pass", notes };
}
