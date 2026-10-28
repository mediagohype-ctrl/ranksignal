import type { ReactNode } from "react";
import { Notice } from "@/components/ui";
import { PageHero, Prose } from "./ui";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={title} intro={<p>Last updated: {updated}</p>} />
      <div className="bg-bg py-14 sm:py-20">
        <div className="container-marketing">
          <div className="mx-auto max-w-3xl">
            <Notice tone="warning" title="Draft — pending legal review" className="mb-8">
              This is placeholder text and is not yet a binding legal document. It will be replaced before general
              availability.
            </Notice>
            <article className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-10">
              <Prose>{children}</Prose>
            </article>
          </div>
        </div>
      </div>
    </>
  );
}
