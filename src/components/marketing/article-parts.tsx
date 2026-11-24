// Shared parts of every /learn guide and /blog post (SEO fix brief P4 + P8): the byline under the H1, the author
// box at the end, the "Related guides" block, and the author/publisher JSON-LD.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AUTHORS, DEFAULT_AUTHOR, authorUrl, type Author } from "@/lib/authors";
import { BRAND } from "@/lib/brand";

/** Names that mean "the company" rather than a person: those posts are credited to the default author. */
const GENERIC = /team|staff|admin|editor|mywebrank|ranksignal/i;

/** The author to credit for a byline: a known author by name, otherwise the default author. */
export function authorFor(name?: string | null): Author {
  const n = (name ?? "").trim().toLowerCase();
  const known = Object.values(AUTHORS).find((a) => a.name.toLowerCase() === n);
  if (known) return known;
  return DEFAULT_AUTHOR;
}

/** Whether a free-text author name should be replaced by the default author (empty or a company name). */
export function isGenericAuthor(name?: string | null): boolean {
  return !name?.trim() || GENERIC.test(name);
}

const fmt = (d: string | Date) =>
  new Date(typeof d === "string" ? `${d.slice(0, 10)}T00:00:00Z` : d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** "By Shubhankar Gupta · Updated 24 Nov 2026" (+ optional "· 6 min read"). */
export function Byline({ author, updated, extra, lang = "en" }: { author: Author; updated: string | Date; extra?: string; lang?: "en" | "hi" }) {
  const iso = typeof updated === "string" ? updated.slice(0, 10) : updated.toISOString().slice(0, 10);
  return (
    <p>
      {lang === "hi" ? "लेखक " : "By "}
      <Link href={authorUrl(author.slug)} rel="author" className="font-semibold text-fg underline-offset-4 hover:underline">
        {author.name}
      </Link>
      {" · "}
      {lang === "hi" ? "अपडेट " : "Updated "}
      <time dateTime={iso}>{fmt(iso)}</time>
      {extra ? ` · ${extra}` : null}
    </p>
  );
}

function Avatar({ author, size = 56 }: { author: Author; size?: number }) {
  const initials = author.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return author.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={author.photo} alt={author.name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, fontWeight: 700 }}
    >
      {initials}
    </span>
  );
}

/** Author box at the end of an article: photo (or initials), short bio, profile links. */
export function AuthorBox({ author, lang = "en" }: { author: Author; lang?: "en" | "hi" }) {
  return (
    <aside aria-label={lang === "hi" ? "लेखक के बारे में" : "About the author"} className="mt-12 flex gap-4 rounded-2xl border border-border bg-surface p-5 sm:gap-5 sm:p-6">
      <Avatar author={author} />
      <div className="min-w-0">
        <p className="text-caption uppercase tracking-[0.06em] text-muted">{lang === "hi" ? "लेखक" : "Written by"}</p>
        <p className="mt-1 text-body font-semibold text-fg">
          <Link href={authorUrl(author.slug)} rel="author" className="hover:underline">
            {author.name}
          </Link>
          <span className="font-normal text-muted"> · {author.role}</span>
        </p>
        <p className="mt-2 text-small leading-relaxed text-fg-soft" lang="en">
          {author.bio[0]}
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small">
          <Link href={authorUrl(author.slug)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            {lang === "hi" ? "सभी लेख" : "All articles"}
            <ArrowRight aria-hidden size={14} />
          </Link>
          {author.sameAs.map((u) => (
            <a key={u} href={u} rel="me noopener" className="font-medium text-primary hover:underline">
              {/linkedin/i.test(u) ? "LinkedIn" : /x\.com|twitter/i.test(u) ? "X" : new URL(u).hostname.replace(/^www\./, "")}
            </a>
          ))}
        </p>
      </div>
    </aside>
  );
}

/** "Related guides" block at the end of an article (3 links). */
export function RelatedBlock({ title = "Related guides", items }: { title?: string; items: { href: string; title: string; summary?: string }[] }) {
  if (!items.length) return null;
  return (
    <nav aria-label={title} className="mt-10">
      <h2 className="text-h4 text-fg">{title}</h2>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.slice(0, 3).map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover"
            >
              <span className="text-small font-semibold leading-snug text-fg group-hover:text-primary">{r.title}</span>
              {r.summary && <span className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">{r.summary}</span>}
              <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-primary">
                Read
                <ArrowRight aria-hidden size={13} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Person JSON-LD for the author (used in Article/BlogPosting `author` and on the author page). */
export function personLd(author: Author, base: string): Record<string, unknown> {
  return {
    "@type": "Person",
    "@id": `${base}${authorUrl(author.slug)}#person`,
    name: author.name,
    url: `${base}${authorUrl(author.slug)}`,
    jobTitle: author.role,
    ...(author.photo ? { image: author.photo.startsWith("http") ? author.photo : `${base}${author.photo}` } : {}),
    ...(author.sameAs.length ? { sameAs: author.sameAs } : {}),
    knowsAbout: author.knowsAbout,
    worksFor: { "@id": `${base}/#organization`, name: BRAND.name },
  };
}
