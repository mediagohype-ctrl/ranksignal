// Suggested Google headlines and summaries for a BATCH of pages (audit fix 31). Rules:
// - every suggestion in a batch is different (never "Shop | Pubesto" for 15 pages);
// - the home page is about the whole business ("Pubesto: Portable Fans, Bottles & Festive Decor Online in India"),
//   built from what the business sells — not one product;
// - product pages: product name + what people search ("Adjustable Bladeless Neck Fan – Buy Online in India | Pubesto"),
//   the "Buy Online in India" part only for online stores serving India;
// - other pages: the page's own main heading, or its address when the heading is shared or generic.
// Keep ≤ 60 characters where possible. Pure (no I/O); the LLM path in recommendations/job.ts never touches titles.
import type { ExtractedPage } from "@/lib/types";

export interface TitlePage {
  url: string;
  extracted?: Partial<Pick<ExtractedPage, "title" | "h1" | "schemaTypes" | "description" | "textSample">> | null;
}

export interface TitleContext {
  brand: string;
  /** What the business sells (setup "What you sell"). */
  sells?: string | null;
  city?: string | null;
  /** ISO country code of the customers ("IN"). */
  country?: string | null;
  isStore?: boolean;
}

export const TITLE_LIMIT = 60;
/** The "what people search" add-ons ("… Online in India", "– Buy Online in India") may run a little over 60. */
const SOFT_LIMIT = 65;

const GENERIC = /^(home|homepage|welcome|shop|store|products?|all products|collections?|catalog(ue)?|blog|news|page|pages|services|our services|about|contact|untitled|index|default|category|categories|search|results?)$/i;

const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w) => (w.length > 2 && w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function fit(s: string, n = TITLE_LIMIT): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > n * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:|–-]+$/, "")}…`;
}

function pathParts(url: string): string[] {
  try {
    return new URL(url).pathname
      .split("/")
      .filter(Boolean)
      .map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return s;
        }
      });
  } catch {
    return [];
  }
}

const words = (seg: string) => titleCase(seg.replace(/\.\w{2,5}$/, "").replace(/[-_+]+/g, " ").trim());

function isHome(url: string): boolean {
  return pathParts(url).length === 0;
}

export function isProductPage(p: TitlePage): boolean {
  if ((p.extracted?.schemaTypes ?? []).includes("Product")) return true;
  const parts = pathParts(p.url);
  return parts.length >= 2 && /^(product|products|item|items|p)$/i.test(parts[parts.length - 2]);
}

/** "Portable fans, bottles and festive decor" → "Portable Fans, Bottles & Festive Decor". */
function sellsPhrase(sells: string): string {
  return titleCase(clean(sells).replace(/[.!]+$/, "").replace(/\band\b/gi, "&"));
}

const servesIndia = (c: TitleContext) => !!c.isStore && (c.country ?? "").toUpperCase() === "IN";

/** The page's subject: its main heading when specific to it, else words from its address. */
function subjectOf(p: TitlePage, ctx: TitleContext, sharedH1: Set<string>): string {
  const h1 = clean(p.extracted?.h1?.[0]);
  const brandKey = ctx.brand.trim().toLowerCase();
  if (h1 && h1.length <= 70 && !GENERIC.test(h1) && h1.toLowerCase() !== brandKey && !sharedH1.has(h1.toLowerCase())) return h1;
  const parts = pathParts(p.url).filter((s) => !/^(product|products|item|items|p|pages?|collections?|category|categories|blog|posts?)$/i.test(s));
  const last = parts[parts.length - 1];
  if (last) {
    const w = words(last);
    // A heading many pages share ("Shop", "Creative Digital Marketing Agency in Delhi") can't tell them apart: use the address.
    return w;
  }
  return h1 || ctx.brand;
}

/** The home page: business-wide, from what the business sells. */
export function homeTitle(ctx: TitleContext, p?: TitlePage): string {
  const brand = ctx.brand.trim();
  const sells = ctx.sells ? sellsPhrase(ctx.sells) : "";
  if (sells) {
    const tail = servesIndia(ctx) ? " Online in India" : ctx.city ? ` in ${ctx.city}` : "";
    const full = `${brand}: ${sells}${tail}`;
    return full.length <= SOFT_LIMIT ? full : fit(`${brand}: ${sells}`);
  }
  const h1 = clean(p?.extracted?.h1?.[0]);
  if (h1 && h1.toLowerCase() !== brand.toLowerCase() && !GENERIC.test(h1)) return fit(`${brand} – ${h1}`);
  return fit(ctx.city ? `${brand} – ${ctx.city}` : brand);
}

/** One page's headline (before the batch makes them unique). */
function baseTitle(p: TitlePage, ctx: TitleContext, sharedH1: Set<string>): string {
  const brand = ctx.brand.trim();
  if (isHome(p.url)) return homeTitle(ctx, p);
  const subject = subjectOf(p, ctx, sharedH1);
  if (isProductPage(p)) {
    const buy = servesIndia(ctx) ? " – Buy Online in India" : "";
    const full = `${subject}${buy} | ${brand}`;
    if (full.length <= SOFT_LIMIT) return full;
    const short = `${subject} | ${brand}`;
    return short.length <= TITLE_LIMIT ? short : `${fit(subject, Math.max(20, TITLE_LIMIT - brand.length - 3))} | ${brand}`;
  }
  const suffix = ` | ${brand}`;
  return `${fit(subject, Math.max(20, TITLE_LIMIT - suffix.length))}${suffix}`;
}

/**
 * Suggested headlines for every page, all different. Same order as `pages`. When two pages would get the same
 * headline, the one further down gets a detail from its own address ("/shop/fans/page/2" → "… – Page 2", or the
 * parent folder), and as a last resort its address.
 */
export function suggestTitles(pages: TitlePage[], ctx: TitleContext): string[] {
  const h1Count = new Map<string, number>();
  for (const p of pages) {
    const h = clean(p.extracted?.h1?.[0]).toLowerCase();
    if (h) h1Count.set(h, (h1Count.get(h) ?? 0) + 1);
  }
  const shared = new Set([...h1Count].filter(([, n]) => n > 1).map(([h]) => h));
  const used = new Set<string>();
  return pages.map((p) => {
    let t = baseTitle(p, ctx, shared);
    if (used.has(t.toLowerCase())) {
      const parts = pathParts(p.url);
      const pageNo = (() => {
        try {
          return new URL(p.url).searchParams.get("page") ?? (/^\d+$/.test(parts[parts.length - 1] ?? "") ? parts[parts.length - 1] : null);
        } catch {
          return null;
        }
      })();
      const brand = ctx.brand.trim();
      const subject = t.replace(new RegExp(`\\s*\\|\\s*${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
      const extras = [
        pageNo ? `Page ${pageNo}` : null,
        parts.length >= 2 ? words(parts[parts.length - 2]) : null,
        parts.length ? words(parts.join(" ")) : null,
      ].filter((x): x is string => !!x && !subject.toLowerCase().includes(x.toLowerCase()));
      for (const e of extras) {
        const cand = `${fit(`${subject} – ${e}`, Math.max(20, TITLE_LIMIT - brand.length - 3))} | ${brand}`;
        if (!used.has(cand.toLowerCase())) {
          t = cand;
          break;
        }
      }
      let n = 2;
      while (used.has(t.toLowerCase())) t = `${fit(subject, TITLE_LIMIT - brand.length - 8)} (${n++}) | ${brand}`;
    }
    used.add(t.toLowerCase());
    return t;
  });
}

function firstSentence(text: string): string {
  const m = clean(text).match(/^(.{30,200}?[.!?])(\s|$)/);
  return m ? m[1] : clean(text).slice(0, 150);
}

/**
 * Suggested Google summaries (120–155 characters where the page gives us enough), all different. Built from the
 * page's own words — never invented claims.
 */
export function suggestSummaries(pages: TitlePage[], ctx: TitleContext): string[] {
  const titles = suggestTitles(pages, ctx);
  const used = new Set<string>();
  const brand = ctx.brand.trim();
  return pages.map((p, i) => {
    const subject = isHome(p.url) ? brand : titles[i].replace(/\s*\|.*$/, "");
    const lead = p.extracted?.textSample ? firstSentence(p.extracted.textSample) : "";
    const what = ctx.sells ? clean(ctx.sells).replace(/[.!]+$/, "").toLowerCase() : "";
    let s = lead && lead.length >= 40 && !lead.toLowerCase().startsWith(subject.toLowerCase()) ? `${subject}: ${lead}` : lead;
    if (!s || s.length < 60) {
      s = isHome(p.url)
        ? `${brand}${what ? ` – ${what}` : ""}${ctx.city ? ` in ${ctx.city}` : servesIndia(ctx) ? ", delivered across India" : ""}. ${lead || "See what we offer and get in touch."}`
        : `${subject} from ${brand}${what ? `, for ${what}` : ""}. ${lead || "See details, prices and how to order."}`;
    }
    s = fit(clean(s), 155);
    let n = 2;
    const base = s;
    while (used.has(s.toLowerCase())) {
      s = `${fit(base.replace(/…$/, ""), 120)} (${pageLabel(p.url)}${n > 2 ? ` ${n}` : ""})`;
      n++;
    }
    used.add(s.toLowerCase());
    return s;
  });
}

function pageLabel(url: string): string {
  const parts = pathParts(url);
  return parts.length ? `/${parts.join("/")}` : "home page";
}
