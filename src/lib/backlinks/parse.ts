// Pure, defensive parsers for DataForSEO Backlinks API v3 answers (field names per the v3 docs). Never trust a field
// exists; numbers that are missing stay null (shown as "—"), never 0. No DB / server imports: client components and
// tests import this module.

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null);
const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.max(0, Math.round(n));
};

/** DataForSEO rank on our 0–100 scale (we request rank_scale "one_hundred"; old 0–1000 answers are scaled down). */
export function rank100(v: unknown): number | null {
  const n = num(v);
  if (n === null || n < 0) return null;
  return Math.min(100, Math.round(n > 100 ? n / 10 : n));
}

/** "2021-09-12 05:42:21 +00:00" (or ISO) → "2021-09-12"; junk → null. */
export function isoDay(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(`${m[1]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : m[1];
}

const cleanDomain = (v: unknown): string | null => {
  const s = str(v)?.toLowerCase().replace(/^www\./, "");
  return s && s.length <= 253 && /^[a-z0-9.-]+\.[a-z0-9-]{2,}$/.test(s) ? s : null;
};
const cleanUrl = (v: unknown): string | null => {
  const s = str(v);
  if (!s || s.length > 2048) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};
const clip = (v: unknown, max: number): string | null => {
  const s = str(v);
  return s ? s.replace(/\s+/g, " ").slice(0, max) : null;
};

/** The first result object's items (DataForSEO wraps lists as result[0].items) plus its total_count. */
function listOf(result: unknown[]): { items: Json[]; total: number | null } {
  const first = result.find(isObj);
  if (!first) return { items: [], total: null };
  return { items: arr(first.items).filter(isObj), total: int(first.total_count) };
}

// ---- summary -------------------------------------------------------------------------------------------------------

export interface BacklinkSummary {
  backlinks: number | null;
  referringDomains: number | null;
  referringMainDomains: number | null;
  referringPages: number | null;
  /** Domain strength 0–100 (DataForSEO rank). */
  rank: number | null;
  brokenBacklinks: number | null;
  brokenPages: number | null;
  dofollow: number | null;
  nofollow: number | null;
  referringDomainsNofollow: number | null;
  /** DataForSEO spam score 0–100 of the backlink profile. */
  spamScore: number | null;
  firstSeen: string | null;
}

export function parseSummary(result: unknown[]): BacklinkSummary | null {
  const r = result.find(isObj);
  if (!r) return null;
  const backlinks = int(r.backlinks);
  const attrs = isObj(r.referring_links_attributes) ? r.referring_links_attributes : {};
  const nofollow = int(attrs.nofollow) ?? int(r.backlinks_nofollow);
  const dofollow = backlinks !== null && nofollow !== null ? Math.max(0, backlinks - nofollow) : null;
  return {
    backlinks,
    referringDomains: int(r.referring_domains),
    referringMainDomains: int(r.referring_main_domains),
    referringPages: int(r.referring_pages),
    rank: rank100(r.rank),
    brokenBacklinks: int(r.broken_backlinks),
    brokenPages: int(r.broken_pages),
    dofollow,
    nofollow: nofollow === null ? null : backlinks !== null ? Math.min(nofollow, backlinks) : nofollow,
    referringDomainsNofollow: int(r.referring_domains_nofollow),
    spamScore: int(r.backlinks_spam_score),
    firstSeen: isoDay(r.first_seen),
  };
}

// ---- referring domains ---------------------------------------------------------------------------------------------

export interface ReferringDomain {
  domain: string;
  rank: number | null;
  backlinks: number | null;
  /** Links from this site that pass on trust ("followed"). */
  dofollow: number | null;
  firstSeen: string | null;
  spamScore: number | null;
}

export function parseReferringDomains(result: unknown[]): { items: ReferringDomain[]; total: number | null } {
  const { items, total } = listOf(result);
  const seen = new Set<string>();
  const out: ReferringDomain[] = [];
  for (const it of items) {
    const domain = cleanDomain(it.domain);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    const backlinks = int(it.backlinks);
    const attrs = isObj(it.referring_links_attributes) ? it.referring_links_attributes : {};
    const nofollow = int(attrs.nofollow);
    out.push({
      domain,
      rank: rank100(it.rank),
      backlinks,
      dofollow: backlinks !== null && nofollow !== null ? Math.max(0, backlinks - nofollow) : null,
      firstSeen: isoDay(it.first_seen),
      spamScore: int(it.backlinks_spam_score),
    });
  }
  return { items: out, total };
}

// ---- backlinks -----------------------------------------------------------------------------------------------------

export interface Backlink {
  domainFrom: string;
  urlFrom: string;
  urlTo: string | null;
  anchor: string | null;
  pageTitle: string | null;
  dofollow: boolean | null;
  /** Strength 0–100 of the linking site. */
  domainRank: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  isBroken: boolean;
  /** anchor | image | redirect | canonical | … */
  kind: string | null;
}

export function parseBacklinks(result: unknown[]): { items: Backlink[]; total: number | null } {
  const { items, total } = listOf(result);
  const out: Backlink[] = [];
  for (const it of items) {
    const urlFrom = cleanUrl(it.url_from);
    if (!urlFrom) continue;
    const domainFrom = cleanDomain(it.domain_from) ?? cleanDomain(new URL(urlFrom).hostname);
    if (!domainFrom) continue;
    out.push({
      domainFrom,
      urlFrom,
      urlTo: cleanUrl(it.url_to),
      anchor: clip(it.anchor, 300),
      pageTitle: clip(it.page_from_title, 300),
      dofollow: typeof it.dofollow === "boolean" ? it.dofollow : null,
      domainRank: rank100(it.domain_from_rank ?? it.rank),
      firstSeen: isoDay(it.first_seen),
      lastSeen: isoDay(it.last_seen),
      isBroken: it.is_broken === true,
      kind: str(it.item_type),
    });
  }
  return { items: out, total };
}

// ---- anchors -------------------------------------------------------------------------------------------------------

export interface AnchorRow {
  /** null = links with no words (e.g. an image link). */
  anchor: string | null;
  backlinks: number | null;
  referringDomains: number | null;
  firstSeen: string | null;
}

export function parseAnchors(result: unknown[]): { items: AnchorRow[]; total: number | null } {
  const { items, total } = listOf(result);
  return {
    items: items.map((it) => ({
      anchor: clip(it.anchor, 300),
      backlinks: int(it.backlinks),
      referringDomains: int(it.referring_domains),
      firstSeen: isoDay(it.first_seen),
    })),
    total,
  };
}

// ---- new & lost (timeseries_new_lost_summary) ----------------------------------------------------------------------

export interface NewLostPoint {
  date: string;
  newBacklinks: number | null;
  lostBacklinks: number | null;
  newDomains: number | null;
  lostDomains: number | null;
}

export function parseNewLost(result: unknown[]): NewLostPoint[] {
  const { items } = listOf(result);
  const out: NewLostPoint[] = [];
  for (const it of items) {
    const date = isoDay(it.date);
    if (!date) continue;
    out.push({
      date,
      newBacklinks: int(it.new_backlinks),
      lostBacklinks: int(it.lost_backlinks),
      newDomains: int(it.new_referring_domains),
      lostDomains: int(it.lost_referring_domains),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---- link gap (domain_intersection) --------------------------------------------------------------------------------

export interface LinkGapItem {
  domain: string;
  /** Strength 0–100 of the linking site. */
  rank: number | null;
  /** Links from this site to the competitors it links to (sum). */
  backlinks: number | null;
  /** Competitor domains this site links to. */
  linksTo: string[];
}

/**
 * domain_intersection answers either `items[].domain_intersection["1"|"2"|…]` (current) or `items[]["1"|"2"|…]`
 * (older) — each entry describes the referring domain's links to targets[n]. `targets` maps "1" → competitor domain.
 */
export function parseDomainIntersection(result: unknown[], targets: Record<string, string>): { items: LinkGapItem[]; total: number | null } {
  const { items, total } = listOf(result);
  const out = new Map<string, LinkGapItem>();
  for (const it of items) {
    const entries = isObj(it.domain_intersection) ? it.domain_intersection : it;
    let domain: string | null = null;
    let rank: number | null = null;
    let backlinks: number | null = null;
    const linksTo: string[] = [];
    for (const [key, entry] of Object.entries(entries)) {
      if (!/^\d+$/.test(key) || !isObj(entry)) continue;
      const linked = (int(entry.backlinks) ?? 1) > 0;
      domain ??= cleanDomain(entry.domain);
      const r = rank100(entry.rank);
      if (r !== null) rank = Math.max(rank ?? 0, r);
      const b = int(entry.backlinks);
      if (b !== null) backlinks = (backlinks ?? 0) + b;
      const competitor = targets[key] ?? cleanDomain(entry.target);
      if (linked && competitor && !linksTo.includes(competitor)) linksTo.push(competitor);
    }
    if (!domain || !linksTo.length || out.has(domain)) continue;
    out.set(domain, { domain, rank, backlinks, linksTo });
  }
  const list = [...out.values()].sort((a, b) => b.linksTo.length - a.linksTo.length || (b.rank ?? -1) - (a.rank ?? -1));
  return { items: list, total };
}

// ---- snapshot data + diff ------------------------------------------------------------------------------------------

export type BacklinkSection = "summary" | "referringDomains" | "backlinks" | "anchors" | "newLost";

export interface BacklinkSnapshotData {
  summary: BacklinkSummary | null;
  referringDomains: ReferringDomain[];
  referringDomainsTotal: number | null;
  backlinks: Backlink[];
  backlinksTotal: number | null;
  anchors: AnchorRow[];
  anchorsTotal: number | null;
  newLost: NewLostPoint[];
  /** Sections whose call failed in this refresh (shown as "couldn't load this part"). */
  sectionErrors: BacklinkSection[];
}

export const EMPTY_SNAPSHOT_DATA: BacklinkSnapshotData = {
  summary: null,
  referringDomains: [],
  referringDomainsTotal: null,
  backlinks: [],
  backlinksTotal: null,
  anchors: [],
  anchorsTotal: null,
  newLost: [],
  sectionErrors: [],
};

/** Read a stored snapshot JSON back (tolerates older / partial shapes). */
export function readSnapshotData(v: unknown): BacklinkSnapshotData {
  if (!isObj(v)) return { ...EMPTY_SNAPSHOT_DATA };
  const a = <T>(x: unknown) => arr(x).filter(isObj) as unknown as T[];
  return {
    summary: isObj(v.summary) ? (v.summary as unknown as BacklinkSummary) : null,
    referringDomains: a<ReferringDomain>(v.referringDomains),
    referringDomainsTotal: num(v.referringDomainsTotal),
    backlinks: a<Backlink>(v.backlinks),
    backlinksTotal: num(v.backlinksTotal),
    anchors: a<AnchorRow>(v.anchors),
    anchorsTotal: num(v.anchorsTotal),
    newLost: a<NewLostPoint>(v.newLost),
    sectionErrors: arr(v.sectionErrors).filter((s): s is BacklinkSection => typeof s === "string"),
  };
}

export interface DomainChanges {
  /** Linking sites that appeared since the previous refresh (or first seen in the last 30 days on the first refresh). */
  gained: ReferringDomain[];
  /** In the previous refresh's top list but not in this one: the link may be gone, or the site was pushed out of the top list. */
  gone: ReferringDomain[];
  comparedWith: string | null;
}

export function diffReferringDomains(
  current: ReferringDomain[],
  previous: { list: ReferringDomain[]; takenAt: string } | null,
  now = new Date(),
): DomainChanges {
  if (!previous) {
    const since = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
    return { gained: current.filter((d) => d.firstSeen !== null && d.firstSeen >= since), gone: [], comparedWith: null };
  }
  const before = new Set(previous.list.map((d) => d.domain));
  const after = new Set(current.map((d) => d.domain));
  return {
    gained: current.filter((d) => !before.has(d.domain)),
    gone: previous.list.filter((d) => !after.has(d.domain)),
    comparedWith: previous.takenAt,
  };
}
