// Keyword research (DataForSEO Labs): request building, a defensive response parser and the plain-English labels the
// page shows. Pure module — safe to import from server and client code. The paid call itself lives in ./service.ts.
import { arr, isObj, num, str } from "./json";

/** "suggestions" = searches that contain your words (keyword_suggestions); "ideas" = related searches on the same topic (keyword_ideas). */
export type KeywordMode = "suggestions" | "ideas";
export const KEYWORD_MODES: { id: KeywordMode; label: string; hint: string }[] = [
  { id: "suggestions", label: "Searches containing my words", hint: "Longer searches that include your words, e.g. “plumber” → “emergency plumber near me”." },
  { id: "ideas", label: "Related topics", hint: "Searches on the same topic even when the words differ, e.g. “plumber” → “tap repair”." },
];
export const KEYWORD_PATHS: Record<KeywordMode, string> = {
  suggestions: "/v3/dataforseo_labs/google/keyword_suggestions/live",
  ideas: "/v3/dataforseo_labs/google/keyword_ideas/live",
};

/** How many keyword ideas one lookup returns (one paid call, one allowance unit). */
export const KEYWORD_RESULT_LIMIT = 200;
/** Cost estimates in micro-USD (deliberately high): Labs ≈ $0.01–0.015 per call plus ≈ $0.0001 per returned item. */
export const LABS_CALL_MICROS = 15_000;
export const LABS_ITEM_MICROS = 150;
export const KEYWORD_ESTIMATE_MICROS = LABS_CALL_MICROS + LABS_ITEM_MICROS * KEYWORD_RESULT_LIMIT;
/** Keyword ideas change slowly: the same lookup is reused (free) for 30 days. */
export const KEYWORD_CACHE_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * DataForSEO reports cost per click in US dollars. We show an approximate rupee figure; the rate is a constant on
 * purpose (bids are rough averages anyway) and the page says it's approximate.
 */
export const INR_PER_USD = 85;

export type Intent = "informational" | "commercial" | "transactional" | "navigational";
export const INTENT_INFO: Record<Intent, { label: string; explain: string }> = {
  informational: { label: "Learning", explain: "People want information or an answer (e.g. “how to fix a leaking tap”)." },
  commercial: { label: "Comparing", explain: "People are comparing options before they buy (e.g. “best plumber in Pune”)." },
  transactional: { label: "Ready to buy", explain: "People want to buy, book or call now (e.g. “book plumber online”)." },
  navigational: { label: "Looking for a brand", explain: "People want one specific website or business (e.g. “urban company login”)." },
};

export type DifficultyBand = "easy" | "medium" | "hard";
export const DIFFICULTY_INFO: Record<DifficultyBand, { label: string; explain: string }> = {
  easy: { label: "Easy", explain: "0–29: a good, helpful page can reach page one without many links from other sites." },
  medium: { label: "Medium", explain: "30–59: you'll need a strong page and some links or mentions from other sites." },
  hard: { label: "Hard", explain: "60–100: big, well-known sites hold the top spots. Expect months of work." },
};
export function difficultyBand(kd: number | null): DifficultyBand | null {
  if (kd === null) return null;
  return kd < 30 ? "easy" : kd < 60 ? "medium" : "hard";
}

export interface KeywordIdea {
  keyword: string;
  /** Average monthly Google searches in the country. Null when Google has no figure. */
  volume: number | null;
  /** Keyword difficulty 0–100 (DataForSEO). */
  difficulty: number | null;
  intent: Intent | null;
  /** Cost per click in US dollars as reported (converted to ₹ for display). */
  cpcUsd: number | null;
  /** Up to 12 monthly volumes, oldest first. */
  trend: { month: string; volume: number }[];
  isQuestion: boolean;
}

export interface KeywordResult {
  seed: string;
  mode: KeywordMode;
  countryCode: number;
  languageId: string;
  totalCount: number | null;
  items: KeywordIdea[];
}

const INTENTS = new Set<Intent>(["informational", "commercial", "transactional", "navigational"]);

// Question starters in English, Hinglish and Hindi (Devanagari).
const QUESTION_RE =
  /^(how|what|why|when|where|which|who|whom|whose|is|are|can|should|does|kya|kaise|kyu|kyun|kyon|kab|kahan|kaun|kitna|kitne|kitni|कैसे|क्या|क्यों|कब|कहाँ|कहां|कौन|कितना|कितने|कितनी)(?=\s|$|\?)/u;
export function isQuestion(keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (k.endsWith("?")) return true;
  if (QUESTION_RE.test(k)) return true;
  // Hindi questions often end with the question word ("... kaise kare", "... kya hai").
  return /(^|\s)(kaise|kya hai|kyu|kyon|kab|kahan|कैसे|क्या है|क्यों)(?=\s|$|\?)/u.test(k);
}

/** DataForSEO Labs task for one lookup. Labs data is country-level, so cities use their country (countryCodeFor). */
export function buildKeywordTask(seed: string, countryCode: number, languageId: string, mode: KeywordMode): Record<string, unknown> {
  const base = {
    location_code: countryCode,
    language_code: languageId,
    limit: KEYWORD_RESULT_LIMIT,
    order_by: ["keyword_info.search_volume,desc"],
  };
  return mode === "ideas"
    ? { ...base, keywords: [seed], include_serp_info: false }
    : { ...base, keyword: seed, include_seed_keyword: true, include_serp_info: false };
}

/** Normalised cache key: same seed + country + language + mode = same paid lookup. */
export function keywordRequestKey(seed: string, countryCode: number, languageId: string, mode: KeywordMode): string {
  return `kw:v1:${mode}:${countryCode}:${languageId}:${seed}`;
}

function parseTrend(v: unknown): { month: string; volume: number }[] {
  const rows: { month: string; volume: number; sort: number }[] = [];
  for (const m of arr(v)) {
    if (!isObj(m)) continue;
    const y = num(m.year);
    const mo = num(m.month);
    const sv = num(m.search_volume);
    if (y === null || mo === null || mo < 1 || mo > 12 || sv === null) continue;
    rows.push({ month: `${y}-${String(mo).padStart(2, "0")}`, volume: Math.max(0, Math.round(sv)), sort: y * 12 + mo });
  }
  rows.sort((a, b) => a.sort - b.sort);
  const seen = new Set<string>();
  const out = rows.filter((r) => (seen.has(r.month) ? false : (seen.add(r.month), true)));
  return out.slice(-12).map(({ month, volume }) => ({ month, volume }));
}

function parseIdea(raw: unknown): KeywordIdea | null {
  if (!isObj(raw)) return null;
  // related_keywords wraps each row in keyword_data; suggestions/ideas don't.
  const item = isObj(raw.keyword_data) ? raw.keyword_data : raw;
  const keyword = str(item.keyword)?.trim();
  if (!keyword || keyword.length > 200) return null;
  const info = isObj(item.keyword_info) ? item.keyword_info : {};
  const props = isObj(item.keyword_properties) ? item.keyword_properties : {};
  const intentInfo = isObj(item.search_intent_info) ? item.search_intent_info : {};
  const vol = num(info.search_volume);
  const kd = num(props.keyword_difficulty);
  const cpc = num(info.cpc);
  const mainIntent = str(intentInfo.main_intent);
  return {
    keyword,
    volume: vol === null ? null : Math.max(0, Math.round(vol)),
    difficulty: kd === null ? null : Math.max(0, Math.min(100, Math.round(kd))),
    intent: mainIntent && INTENTS.has(mainIntent as Intent) ? (mainIntent as Intent) : null,
    cpcUsd: cpc === null || cpc < 0 ? null : Math.round(cpc * 100) / 100,
    trend: parseTrend(info.monthly_searches),
    isQuestion: isQuestion(keyword),
  };
}

/** Parse `tasks[0].result` of keyword_suggestions / keyword_ideas / related_keywords into our shape. Never throws. */
export function parseKeywordIdeas(result: unknown[], meta: { seed: string; mode: KeywordMode; countryCode: number; languageId: string }): KeywordResult {
  const first = result.find(isObj);
  const items: KeywordIdea[] = [];
  const seen = new Set<string>();
  const push = (raw: unknown) => {
    const idea = parseIdea(raw);
    if (!idea) return;
    const key = idea.keyword.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(idea);
  };
  if (first) {
    // keyword_suggestions can return the seed separately as seed_keyword_data.
    if (isObj(first.seed_keyword_data)) push({ keyword: first.seed_keyword ?? meta.seed, ...first.seed_keyword_data });
    for (const it of arr(first.items)) push(it);
  }
  items.sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1) || a.keyword.localeCompare(b.keyword));
  return { ...meta, totalCount: first ? num(first.total_count) : null, items };
}

// ---- table filters + CSV (used by the client table; pure so it's unit-tested) ----------------------------------

export type KeywordSort = "volume" | "difficulty" | "cpc" | "keyword";
export interface KeywordFilter {
  contains?: string;
  questionsOnly?: boolean;
  difficulty?: DifficultyBand | "all";
  intent?: Intent | "all";
  minVolume?: number;
  sort?: KeywordSort;
  dir?: "asc" | "desc";
}

export function filterKeywords(items: KeywordIdea[], f: KeywordFilter): KeywordIdea[] {
  const words = (f.contains ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const out = items.filter((k) => {
    if (f.questionsOnly && !k.isQuestion) return false;
    if (f.difficulty && f.difficulty !== "all" && difficultyBand(k.difficulty) !== f.difficulty) return false;
    if (f.intent && f.intent !== "all" && k.intent !== f.intent) return false;
    if (f.minVolume && (k.volume ?? 0) < f.minVolume) return false;
    if (words.length) {
      const kw = k.keyword.toLowerCase();
      if (!words.every((w) => kw.includes(w))) return false;
    }
    return true;
  });
  const sort = f.sort ?? "volume";
  const sign = (f.dir ?? (sort === "keyword" || sort === "difficulty" ? "asc" : "desc")) === "asc" ? 1 : -1;
  const val = (k: KeywordIdea) => (sort === "volume" ? k.volume : sort === "difficulty" ? k.difficulty : sort === "cpc" ? k.cpcUsd : null);
  return [...out].sort((a, b) => {
    if (sort === "keyword") return sign * a.keyword.localeCompare(b.keyword);
    const va = val(a);
    const vb = val(b);
    // Unknown values always go last, whichever direction.
    if (va === null && vb === null) return a.keyword.localeCompare(b.keyword);
    if (va === null) return 1;
    if (vb === null) return -1;
    return sign * (va - vb) || a.keyword.localeCompare(b.keyword);
  });
}

export function cpcInr(cpcUsd: number | null): number | null {
  return cpcUsd === null ? null : Math.round(cpcUsd * INR_PER_USD * 100) / 100;
}

function csvCell(v: string | number | null): string {
  if (v === null) return "";
  let s = String(v);
  // Spreadsheet formula injection guard.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function keywordsToCsv(items: KeywordIdea[]): string {
  const header = ["Keyword", "Monthly searches", "Difficulty (0-100)", "Difficulty", "Intent", "Cost per click (approx. INR)", "Question", "Trend (oldest to newest)"];
  const lines = [header.map(csvCell).join(",")];
  for (const k of items) {
    const band = difficultyBand(k.difficulty);
    lines.push(
      [
        k.keyword,
        k.volume,
        k.difficulty,
        band ? DIFFICULTY_INFO[band].label : null,
        k.intent ? INTENT_INFO[k.intent].label : null,
        cpcInr(k.cpcUsd),
        k.isQuestion ? "yes" : "no",
        k.trend.map((t) => t.volume).join(" "),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
