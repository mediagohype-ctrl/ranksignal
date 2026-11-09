"use client";
// Meta title & description checker: POSTs one page address to /api/public/tools/meta-tag-checker and shows the title,
// description, canonical, robots and share tags with a Google-style preview and a share-card preview.
// Everything shown comes from a third-party page: rendered as React text only (auto-escaped).
import { Badge, Notice } from "@/components/ui";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/audit/rules";
import type { MetaTagReport } from "@/lib/tools/meta-tags";
import { CheckResults, PageUrlForm, ResultCard, usePageCheck } from "./page-check-ui";

type Result = MetaTagReport & { url: string; finalUrl: string };

const TITLE_LABEL: Record<MetaTagReport["title"]["verdict"], { text: string; tone: "success" | "warning" | "danger" }> = {
  missing: { text: "Missing", tone: "danger" },
  too_short: { text: "Too short", tone: "danger" },
  short: { text: "A bit short", tone: "warning" },
  good: { text: "Good length", tone: "success" },
  too_long: { text: "Too long", tone: "warning" },
};
const DESC_LABEL: Record<MetaTagReport["description"]["verdict"], { text: string; tone: "success" | "warning" | "danger" }> = {
  missing: { text: "Missing", tone: "danger" },
  short: { text: "A bit short", tone: "warning" },
  good: { text: "Good length", tone: "success" },
  too_long: { text: "Too long", tone: "warning" },
};

function LengthBar({ length, max, label }: { length: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((length / max) * 100));
  const over = length > max;
  return (
    <div className="mt-2">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(length, max)}
      >
        <div className={`h-full rounded-full ${over ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">
        {length} of about {max} characters{over ? ` (${length - max} over)` : ""}
      </p>
    </div>
  );
}

function TagRow({ name, value }: { name: string; value: string | null }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="font-mono text-xs text-muted">{name}</dt>
      <dd className="break-words text-small text-fg">{value ?? <span className="text-danger">Not set</span>}</dd>
    </div>
  );
}

export function MetaTagChecker() {
  const state = usePageCheck<Result>("/api/public/tools/meta-tag-checker");
  const r = state.result;
  const shareImage = r?.preview.share.image && /^https:\/\//i.test(r.preview.share.image) ? r.preview.share.image : null;

  return (
    <div className="space-y-6">
      <PageUrlForm id="mtc-url" hint="We read the title, description and share tags of this one page." button="Check tags" busyText="Checking…" state={state} />

      {r && (
        <div className="space-y-6" aria-live="polite">
          {r.finalUrl !== r.url && (
            <Notice tone="info">
              That address redirected to <span className="break-all font-medium">{r.finalUrl}</span>. We checked the final page.
            </Notice>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <ResultCard title="Google search preview">
              <div className="rounded-xl border border-border bg-bg p-4">
                <p className="truncate text-xs text-fg-soft">{r.preview.search.displayUrl}</p>
                <p className="mt-1 break-words text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{r.preview.search.title}</p>
                <p className="mt-1 break-words text-small leading-relaxed text-fg-soft">{r.preview.search.description || "(no text found)"}</p>
              </div>
              <p className="mt-2 text-xs text-muted">
                An approximation: Google trims by pixel width and may rewrite the title or summary.
                {r.preview.search.descriptionIsGuess && " There is no meta description, so we show text from the page, as Google might."}
              </p>
            </ResultCard>
            <ResultCard title="Share card preview">
              <div className="overflow-hidden rounded-xl border border-border bg-bg">
                {shareImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- third-party preview image of unknown size
                  <img src={shareImage} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-[1200/630] w-full bg-surface-2 object-cover" />
                ) : (
                  <div className="flex aspect-[1200/630] w-full items-center justify-center bg-surface-2 text-small text-muted">No share image (og:image)</div>
                )}
                <div className="p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">{r.preview.share.domain}</p>
                  <p className="mt-0.5 break-words text-small font-semibold text-fg">{r.preview.share.title}</p>
                  {r.preview.share.description && <p className="mt-0.5 break-words text-xs text-fg-soft">{r.preview.share.description}</p>}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">Roughly how WhatsApp, Facebook, LinkedIn and X show a shared link. Each app crops a little differently.</p>
            </ResultCard>
          </div>

          <CheckResults checks={r.checks} summary={r.summary} pageUrl={r.finalUrl} />

          <div className="grid gap-6 lg:grid-cols-2">
            <ResultCard title="Title" aside={<Badge tone={TITLE_LABEL[r.title.verdict].tone}>{TITLE_LABEL[r.title.verdict].text}</Badge>}>
              <p className="break-words text-body text-fg">{r.title.text ?? <span className="text-danger">No title tag</span>}</p>
              {r.title.text && <LengthBar length={r.title.length} max={TITLE_MAX} label="Title length" />}
              {r.title.count > 1 && <p className="mt-2 text-xs text-warning">{r.title.count} title tags found</p>}
            </ResultCard>
            <ResultCard title="Meta description" aside={<Badge tone={DESC_LABEL[r.description.verdict].tone}>{DESC_LABEL[r.description.verdict].text}</Badge>}>
              <p className="break-words text-body text-fg">{r.description.text ?? <span className="text-danger">No meta description</span>}</p>
              {r.description.text && <LengthBar length={r.description.length} max={DESCRIPTION_MAX} label="Description length" />}
              {r.description.count > 1 && <p className="mt-2 text-xs text-warning">{r.description.count} description tags found</p>}
            </ResultCard>
          </div>

          <ResultCard title="All tags we read">
            <dl className="divide-y divide-border">
              <TagRow name="canonical" value={r.canonical.href} />
              <TagRow name="robots" value={r.robots.content ?? "(none, so indexing is allowed)"} />
              <TagRow name="og:title" value={r.openGraph.title} />
              <TagRow name="og:description" value={r.openGraph.description} />
              <TagRow name="og:image" value={r.openGraph.image} />
              <TagRow name="og:site_name" value={r.openGraph.siteName} />
              <TagRow name="twitter:card" value={r.twitter.card} />
              <TagRow name="twitter:title" value={r.twitter.title} />
              <TagRow name="twitter:description" value={r.twitter.description} />
              <TagRow name="twitter:image" value={r.twitter.image} />
            </dl>
          </ResultCard>
        </div>
      )}
    </div>
  );
}
