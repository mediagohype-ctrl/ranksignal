import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/** Renders a string with [text](/path) links (internal → next/link, others → <a>). No HTML is interpreted. */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, label, href] = m;
    parts.push(
      href.startsWith("/") ? (
        <Link href={href}>{label}</Link>
      ) : (
        <a href={href} rel="noopener">
          {label}
        </a>
      ),
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}
