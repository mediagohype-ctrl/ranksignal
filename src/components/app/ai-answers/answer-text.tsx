// Shows an AI tool's answer the way the person would read it in ChatGPT: headings, lists, tables, bold and links.
// Provider text is untrusted, so it is parsed (lib/dashboard/answer-markdown.ts) and rendered as React elements only —
// never as HTML. Links are http(s) only, tracking codes removed, and open in a new tab with nofollow.
import { Fragment, type ReactNode } from "react";
import clsx from "clsx";
import { hostOf, parseAnswer, type Block, type Inline } from "@/lib/dashboard/answer-markdown";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wraps the business's own names in a highlight so "did it name me?" is visible at a glance. */
function highlight(text: string, names: RegExp | null, key: string): ReactNode {
  if (!names) return text;
  const parts = text.split(names);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <mark key={`${key}-${i}`} className="rounded bg-success-soft px-0.5 font-semibold text-success">
        {p}
      </mark>
    ) : (
      <Fragment key={`${key}-${i}`}>{p}</Fragment>
    ),
  );
}

function plain(c: Inline[]): string {
  return c.map((n) => (n.t === "text" || n.t === "code" ? n.v : "c" in n ? plain(n.c) : "")).join("");
}

function Inlines({ c, names, k }: { c: Inline[]; names: RegExp | null; k: string }) {
  return (
    <>
      {c.map((n, i) => {
        const key = `${k}.${i}`;
        switch (n.t) {
          case "text":
            return <Fragment key={key}>{highlight(n.v, names, key)}</Fragment>;
          case "strong":
            return (
              <strong key={key} className="font-semibold text-fg">
                <Inlines c={n.c} names={names} k={key} />
              </strong>
            );
          case "em":
            return (
              <em key={key}>
                <Inlines c={n.c} names={names} k={key} />
              </em>
            );
          case "code":
            return (
              <code key={key} className="rounded bg-surface-2 px-1 font-mono text-[0.85em]">
                {n.v}
              </code>
            );
          case "link": {
            const label = plain(n.c);
            // Source links like "([upwork.com](…))" read best as a small chip.
            const isSource = label.replace(/^www\./, "") === hostOf(n.href) || /^https?:\/\//.test(label);
            return (
              <a
                key={key}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={clsx(
                  "break-words text-primary hover:underline",
                  isSource && "mx-0.5 inline-flex items-center rounded-full bg-primary-soft px-2 py-px text-xs font-medium no-underline",
                )}
              >
                {isSource ? hostOf(n.href) : <Inlines c={n.c} names={names} k={key} />}
              </a>
            );
          }
        }
      })}
    </>
  );
}

function BlockView({ b, names, k }: { b: Block; names: RegExp | null; k: string }) {
  switch (b.t) {
    case "h":
      return (
        <p className={clsx("font-semibold text-fg", b.level === 1 ? "text-body" : "text-small", "pt-1")}>
          <Inlines c={b.c} names={names} k={k} />
        </p>
      );
    case "p":
      return (
        <p>
          <Inlines c={b.c} names={names} k={k} />
        </p>
      );
    case "quote":
      return (
        <p className="border-l-2 border-border-strong pl-3 italic">
          <Inlines c={b.c} names={names} k={k} />
        </p>
      );
    case "hr":
      return <hr className="border-border" />;
    case "ul":
      return (
        <ul className="list-disc space-y-1 pl-5 marker:text-muted">
          {b.items.map((it, i) => (
            <li key={i}>
              <Inlines c={it} names={names} k={`${k}.${i}`} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol start={b.start} className="list-decimal space-y-1 pl-5 marker:text-muted">
          {b.items.map((it, i) => (
            <li key={i}>
              <Inlines c={it} names={names} k={`${k}.${i}`} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[28rem] text-left text-small">
            <thead className="bg-surface-2">
              <tr>
                {b.head.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-semibold text-fg">
                    <Inlines c={h} names={names} k={`${k}.h${i}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {b.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top">
                      <Inlines c={c} names={names} k={`${k}.${ri}.${ci}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function AnswerText({ text, brandNames = [], className }: { text: string; brandNames?: string[]; className?: string }) {
  const terms = brandNames.map((n) => n.trim()).filter((n) => n.length >= 3);
  const names = terms.length ? new RegExp(`(${terms.map(escapeRe).join("|")})`, "gi") : null;
  const blocks = parseAnswer(text);
  return (
    <div className={clsx("space-y-2.5 break-words text-small leading-relaxed text-fg-soft", className)}>
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} names={names} k={String(i)} />
      ))}
    </div>
  );
}
