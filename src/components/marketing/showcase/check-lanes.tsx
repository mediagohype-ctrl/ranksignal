// "What the free check looks at": three lanes (SEO / AEO / GEO), each with the place it matters (a tiny mock of a
// Google result, an answer box or an AI chat) and the checks we run, as real text. Server component; every word comes
// in through props so the English and Hindi pages share one layout.
import type { ReactNode } from "react";
import clsx from "clsx";
import { ArrowDown, Check } from "lucide-react";

export type LaneMock =
  | { kind: "search"; query: string; site: string; title: string }
  | { kind: "answer"; heading: string; answer: string; source: string }
  | { kind: "chat"; question: string; before: string; name: string; after: string };

export interface Lane {
  /** Short tag, e.g. "SEO". */
  tag: string;
  /** e.g. "Google search". */
  title: string;
  /** One plain line: what this lane means. */
  line: string;
  icon: ReactNode;
  checks: string[];
  mock: LaneMock;
}

export function CheckLanes({
  site,
  siteNote,
  lanes,
  caption,
  lang,
}: {
  /** Label for the starting node, e.g. "yourbusiness.com". */
  site: string;
  /** e.g. "We read your homepage and up to 4 main pages". */
  siteNote: string;
  lanes: Lane[];
  caption: string;
  lang?: string;
}) {
  return (
    <figure lang={lang} className="mx-auto max-w-6xl">
      <div className="flex flex-col items-center text-center">
        <p className="inline-flex h-10 max-w-full items-center rounded-full border border-border-strong bg-surface px-5 font-mono text-small font-medium text-fg shadow-card">
          <span className="truncate">{site}</span>
        </p>
        <p className="mt-2 text-xs text-muted">{siteNote}</p>
        <ArrowDown aria-hidden size={18} className="mt-3 text-border-strong" />
      </div>
      <ol className="mt-3 grid gap-5 md:grid-cols-3">
        {lanes.map((l) => (
          <li key={l.tag} className="mk-reveal flex flex-col overflow-hidden rounded-2xl border border-border bg-bg">
            <div className="h-36 border-b border-border bg-surface-2/60 p-4">
              <LaneMockView mock={l.mock} />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-center gap-3">
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg [&_svg]:size-5">
                  {l.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">{l.tag}</p>
                  <h3 className="text-h4 text-fg">{l.title}</h3>
                </div>
              </div>
              <p className="mt-3 text-small text-fg-soft">{l.line}</p>
              <ul className="mt-4 space-y-2">
                {l.checks.map((c) => (
                  <li key={c} className="flex gap-2 text-small text-muted">
                    <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-score-good" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      <figcaption className="mt-5 text-center text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}

/** Tiny illustration of where each lane matters. Decorative: the lane's text says the same in words. */
function LaneMockView({ mock }: { mock: LaneMock }) {
  if (mock.kind === "search")
    return (
      <div aria-hidden className="flex h-full flex-col gap-2.5">
        <div className="flex h-7 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[11px] text-fg-soft">
          <span className="size-2.5 shrink-0 rounded-full border-[1.5px] border-muted" />
          <span className="truncate">{mock.query}</span>
        </div>
        <div className="rounded-lg bg-surface p-2.5">
          <p className="truncate text-[10px] text-score-good">{mock.site}</p>
          <p className="truncate text-[12px] font-semibold text-primary">{mock.title}</p>
          <span className="mt-1.5 block h-1.5 w-full rounded-full bg-surface-3" />
          <span className="mt-1 block h-1.5 w-3/4 rounded-full bg-surface-3" />
        </div>
      </div>
    );
  if (mock.kind === "answer")
    return (
      <div aria-hidden className="flex h-full flex-col justify-center">
        <div className="rounded-lg border-l-4 border-accent bg-surface p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">{mock.heading}</p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-fg">{mock.answer}</p>
          <p className="mt-1.5 truncate text-[10px] text-muted">{mock.source}</p>
        </div>
      </div>
    );
  return (
    <div aria-hidden className="flex h-full flex-col justify-center gap-2">
      <p className="ml-auto max-w-[85%] truncate rounded-xl rounded-tr-sm bg-surface-3 px-3 py-1.5 text-[11px] text-fg">{mock.question}</p>
      <p className={clsx("max-w-[92%] rounded-xl rounded-tl-sm bg-surface px-3 py-2 text-[11px] leading-snug text-fg-soft", "line-clamp-3")}>
        {mock.before} <mark className="rounded bg-primary-soft px-1 font-semibold text-primary-soft-fg">{mock.name}</mark> {mock.after}
      </p>
    </div>
  );
}
