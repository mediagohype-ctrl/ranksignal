// Renders parsed blog Markdown as React elements (never dangerouslySetInnerHTML).
import Link from "next/link";
import { Fragment } from "react";
import { parseMarkdown, type Block, type Inline } from "@/lib/content/markdown";

function Inlines({ c }: { c: Inline[] }) {
  return (
    <>
      {c.map((n, i) => {
        switch (n.t) {
          case "text":
            return <Fragment key={i}>{n.v}</Fragment>;
          case "code":
            return <code key={i}>{n.v}</code>;
          case "strong":
            return (
              <strong key={i}>
                <Inlines c={n.c} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <Inlines c={n.c} />
              </em>
            );
          case "link":
            return n.href.startsWith("/") ? (
              <Link key={i} href={n.href}>
                <Inlines c={n.c} />
              </Link>
            ) : (
              <a key={i} href={n.href} {...(n.href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}>
                <Inlines c={n.c} />
              </a>
            );
        }
      })}
    </>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case "h2":
      return (
        <h2 id={b.id} className="scroll-mt-24">
          <Inlines c={b.c} />
        </h2>
      );
    case "h3":
      return (
        <h3 id={b.id} className="scroll-mt-24">
          <Inlines c={b.c} />
        </h3>
      );
    case "p":
      return (
        <p>
          <Inlines c={b.c} />
        </p>
      );
    case "ul":
    case "ol": {
      const Tag = b.t;
      return (
        <Tag>
          {b.items.map((it, i) => (
            <li key={i}>
              <Inlines c={it} />
            </li>
          ))}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-4 border-primary/40 pl-4 italic">
          <Inlines c={b.c} />
        </blockquote>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-xl bg-surface-2 p-4 text-small">
          <code>{b.v}</code>
        </pre>
      );
    case "img":
      return (
        // Blog images can live on any https host; next/image would need every host configured.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.src} alt={b.alt} loading="lazy" className="w-full rounded-xl border border-border" />
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-left text-small">
            <thead className="bg-surface-2 text-fg">
              <tr>
                {b.head.map((h, i) => (
                  <th key={i} scope="col" className="px-4 py-3 font-semibold">
                    <Inlines c={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-t border-border align-top">
                  {r.map((c, j) => (
                    <td key={j} className="px-4 py-3">
                      <Inlines c={c} />
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

export function Markdown({ source, blocks }: { source?: string; blocks?: Block[] }) {
  const list = blocks ?? parseMarkdown(source ?? "");
  return (
    <>
      {list.map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </>
  );
}
