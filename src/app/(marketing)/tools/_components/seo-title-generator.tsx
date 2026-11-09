"use client";
// Free AI SEO title generator: page details → POST /api/public/tools/seo-title-generator → 5 checked title drafts.
import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { AI_INPUT_LIMITS as L, type DraftCheck } from "@/lib/tools/ai-writing-checks";
import { PAGE_TYPES, PAGE_TYPE_LABELS, type PageType } from "@/lib/tools/ai-writing-prompts";
import { AiDraftNotice, CheckBadge, CopyButton, GooglePreview, useAiTool } from "./ai-tool-form";

export function SeoTitleGenerator() {
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [brand, setBrand] = useState("");
  const [pageType, setPageType] = useState<PageType>("service");
  const [city, setCity] = useState("");
  const [pick, setPick] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const { run, busy, error, setError, result, captchaNode } = useAiTool<{ titles: DraftCheck[] }>(
    "/api/public/tools/seo-title-generator",
    "seo_title_generator",
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || !keyword.trim()) {
      setError("Fill in what the page is about and its main keyword.");
      return;
    }
    const item = await run({ topic, keyword, brand, pageType, city });
    if (item) {
      setPick(0);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const titles = result?.titles ?? [];
  const chosen = titles[pick] ?? titles[0];

  return (
    <div className="space-y-8">
      <Card variant="elevated" padding="lg" className="mx-auto max-w-2xl">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field label="What is the page about?" htmlFor="tg-topic" hint="One sentence, e.g. emergency plumbing repairs for homes and offices" required>
            <Input id="tg-topic" value={topic} maxLength={L.topic} onChange={(e) => setTopic(e.target.value)} disabled={busy} required />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Main keyword" htmlFor="tg-keyword" hint="What people type into Google" required>
              <Input id="tg-keyword" placeholder="plumber in Pune" value={keyword} maxLength={L.keyword} onChange={(e) => setKeyword(e.target.value)} disabled={busy} required />
            </Field>
            <Field label="Brand name" htmlFor="tg-brand" optional>
              <Input id="tg-brand" placeholder="Sharma Plumbing" value={brand} maxLength={L.brand} onChange={(e) => setBrand(e.target.value)} disabled={busy} />
            </Field>
            <Field label="Page type" htmlFor="tg-type">
              <Select id="tg-type" value={pageType} onChange={(e) => setPageType(e.target.value as PageType)} disabled={busy}>
                {PAGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PAGE_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="City" htmlFor="tg-city" optional>
              <Input id="tg-city" placeholder="Pune" value={city} maxLength={L.city} onChange={(e) => setCity(e.target.value)} disabled={busy} />
            </Field>
          </div>
          {captchaNode}
          {error && (
            <p className="text-small text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">Free · no sign-up · 5 runs per hour.</p>
            <Button type="submit" size="lg" loading={busy} loadingText="Writing titles…" icon={<Sparkles />}>
              {result ? "Write 5 new titles" : "Write 5 titles"}
            </Button>
          </div>
        </form>
      </Card>

      <div ref={resultRef} className="mx-auto max-w-3xl scroll-mt-24 space-y-5" aria-live="polite">
        {titles.length > 0 && (
          <>
            <AiDraftNotice>Pick one, then edit it so it matches the page exactly. Google may rewrite titles that don&apos;t.</AiDraftNotice>
            <ol className="space-y-3">
              {titles.map((t, i) => (
                <li key={t.text} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <p className="break-words text-body font-medium text-fg">{t.text}</p>
                      <CheckBadge check={t} />
                      {t.notes.length > 0 && (
                        <ul className="list-disc space-y-1 pl-5 text-small text-muted">
                          {t.notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant={pick === i ? "primary" : "ghost"} size="sm" onClick={() => setPick(i)} aria-pressed={pick === i}>
                        Preview
                      </Button>
                      <CopyButton text={t.text} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {chosen && (
              <GooglePreview
                title={chosen.text}
                url={`yourwebsite.com › ${keyword.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40) || "page"}`}
                description="Google usually shows your meta description here. Write one with our free meta description generator."
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
