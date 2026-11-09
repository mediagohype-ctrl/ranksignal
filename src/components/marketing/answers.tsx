// Answer-first content blocks for marketing pages: question headings with short direct answers (AEO) and
// outbound links to primary sources (official docs and standards bodies), so pages are quotable and checkable.
import type { ReactNode } from "react";
import { SectionHeading } from "@/components/ui";
import { Section } from "./ui";

export type Qa = { q: string; a: ReactNode };

/** A section of question headings (h3), each followed by a 25–90 word direct answer in a <p>. */
export function QaSection({
  id,
  title,
  eyebrow = "Questions",
  description,
  items,
  tone = "bg",
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  items: Qa[];
  tone?: "bg" | "surface";
  children?: ReactNode;
}) {
  return (
    <Section labelledBy={id} tone={tone}>
      <SectionHeading id={id} size="lg" align="center" eyebrow={eyebrow} title={title} description={description} />
      <div className="mx-auto max-w-3xl space-y-8">
        {items.map((it) => (
          <div key={it.q}>
            <h3 className="text-h4 text-fg">{it.q}</h3>
            <p className="mt-2 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
              {it.a}
            </p>
          </div>
        ))}
        {children}
      </div>
    </Section>
  );
}

/** Outbound link to an authoritative source (official documentation, a standard or a research paper). */
export function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noopener" className="font-medium text-primary underline-offset-4 hover:underline">
      {children}
    </a>
  );
}

/** "Sources" list: the primary references a page's advice is based on. */
export function SourcesList({
  links,
  title = "Sources and further reading",
  className,
}: {
  links: { href: string; label: string; note?: string }[];
  title?: string;
  className?: string;
}) {
  return (
    <div className={className ?? "mx-auto mt-12 max-w-3xl rounded-2xl border border-border bg-surface p-6"}>
      <h3 className="text-h4 text-fg">{title}</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-small leading-relaxed text-fg-soft">
        {links.map((l) => (
          <li key={l.href}>
            <SourceLink href={l.href}>{l.label}</SourceLink>
            {l.note ? ` — ${l.note}` : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
