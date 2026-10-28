import { ExternalLink } from "lucide-react";

const LABEL: Record<string, string> = {
  url: "Page",
  error: "Error",
  status: "Response code",
  chain: "Redirect steps",
  selector: "Looked for",
  title: "Current title",
  description: "Current description",
  length: "Length (characters)",
  h1: "Main headings found",
  skips: "Heading jumps",
  canonical: "Canonical points to",
  robotsMeta: "Robots tag",
  count: "Images without alt text",
  examples: "Example images",
  wordCount: "Word count",
  questionHeadings: "Question headings",
  value: "Shared value",
  others: "Also used on",
  target: "Broken page",
  linkedFrom: "Linked from",
  checked: "Checked",
  blocked: "Blocked crawlers",
  schemaTypes: "Markup types found",
  pagesChecked: "Pages checked",
};

const isUrl = (v: unknown): v is string => typeof v === "string" && /^https?:\/\//i.test(v);

function UrlLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex max-w-full items-center gap-1 break-all text-primary hover:underline"
    >
      <span className="break-all">{href}</span>
      <ExternalLink aria-hidden className="size-3 shrink-0" />
      <span className="sr-only">(opens in new tab)</span>
    </a>
  );
}

function Value({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
  if (isUrl(v)) return <UrlLink href={v} />;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted">None</span>;
    return (
      <ul className="space-y-0.5">
        {v.map((x, i) => (
          <li key={i} className="break-words">
            {isUrl(x) ? <UrlLink href={x} /> : typeof x === "object" ? <code className="font-mono text-xs">{JSON.stringify(x)}</code> : String(x)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof v === "object") return <code className="break-all font-mono text-xs">{JSON.stringify(v)}</code>;
  return <span className="break-words">{String(v)}</span>;
}

/** Evidence recorded by an audit rule, shown as labelled rows. Crawled text is rendered as plain text only. */
export function EvidenceList({ evidence, skipUrl }: { evidence: Record<string, unknown> | null; skipUrl?: string | null }) {
  const entries = Object.entries(evidence ?? {}).filter(([k, v]) => !(k === "url" && v === skipUrl));
  if (entries.length === 0) return <p className="text-small text-muted">No extra details were recorded for this check.</p>;
  return (
    <dl className="grid gap-x-4 gap-y-2 text-small sm:grid-cols-[11rem_minmax(0,1fr)]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{LABEL[k] ?? k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</dt>
          <dd className="min-w-0 text-fg-soft">
            <Value v={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
