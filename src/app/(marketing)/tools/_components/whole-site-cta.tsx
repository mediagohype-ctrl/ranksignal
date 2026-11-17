// Shown after every free tool's result: a tool looks at one page (or one file); the free check looks at the website.
import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui";

export const WHOLE_SITE_LINE = "Check your whole website free.";

export function WholeSiteCta({ lead = "This checked one page." }: { lead?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-body font-medium text-fg">
        {lead} {WHOLE_SITE_LINE}
      </p>
      <LinkButton href="/free-check" className="shrink-0 self-start sm:self-auto">
        Check my website free
        <ArrowRight aria-hidden className="size-4" />
      </LinkButton>
    </div>
  );
}
