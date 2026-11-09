"use client";
// Free AI meta description generator: page details → POST /api/public/tools/meta-description-generator → 5 checked drafts.
import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { AI_INPUT_LIMITS as L, type DraftCheck } from "@/lib/tools/ai-writing-checks";
import { AiDraftNotice, CheckBadge, CopyButton, GooglePreview, useAiTool } from "./ai-tool-form";

export function MetaDescriptionGenerator() {
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [cta, setCta] = useState("");
  const [audience, setAudience] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pick, setPick] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const { run, busy, error, setError, result, captchaNode } = useAiTool<{ descriptions: DraftCheck[] }>(
    "/api/public/tools/meta-description-generator",
    "meta_description_generator",
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || !keyword.trim()) {
      setError("Fill in what the page is about and its main keyword.");
      return;
    }
    const item = await run({ topic, keyword, cta, audience });
    if (item) {
      setPick(0);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const items = result?.descriptions ?? [];
  const chosen = items[pick] ?? items[0];

  return (
    <div className="space-y-8">
      <Card variant="elevated" padding="lg" className="mx-auto max-w-2xl">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field label="What is the page about?" htmlFor="md-topic" hint="A short summary: what you offer, for whom, and where" required>
            <Textarea id="md-topic" rows={3} value={topic} maxLength={L.topic} onChange={(e) => setTopic(e.target.value)} disabled={busy} required />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Main keyword" htmlFor="md-keyword" hint="What people type into Google" required>
              <Input id="md-keyword" placeholder="cake delivery in Jaipur" value={keyword} maxLength={L.keyword} onChange={(e) => setKeyword(e.target.value)} disabled={busy} required />
            </Field>
            <Field label="Call to action" htmlFor="md-cta" optional>
              <Input id="md-cta" placeholder="Order by 4 pm for same-day delivery" value={cta} maxLength={L.cta} onChange={(e) => setCta(e.target.value)} disabled={busy} />
            </Field>
            <Field label="Who is it for?" htmlFor="md-audience" optional>
              <Input id="md-audience" placeholder="Busy parents planning a birthday" value={audience} maxLength={L.audience} onChange={(e) => setAudience(e.target.value)} disabled={busy} />
            </Field>
            <Field label="Page title for the preview" htmlFor="md-title" optional hint="Not sent to the AI">
              <Input id="md-title" value={pageTitle} maxLength={120} onChange={(e) => setPageTitle(e.target.value)} />
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
            <Button type="submit" size="lg" loading={busy} loadingText="Writing descriptions…" icon={<Sparkles />}>
              {result ? "Write 5 new descriptions" : "Write 5 descriptions"}
            </Button>
          </div>
        </form>
      </Card>

      <div ref={resultRef} className="mx-auto max-w-3xl scroll-mt-24 space-y-5" aria-live="polite">
        {items.length > 0 && (
          <>
            <AiDraftNotice>Make sure every detail is true for your page. Google may show other page text if the description doesn&apos;t match.</AiDraftNotice>
            <ol className="space-y-3">
              {items.map((d, i) => (
                <li key={d.text} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <p className="break-words text-body text-fg">{d.text}</p>
                      <CheckBadge check={d} />
                      {d.notes.length > 0 && (
                        <ul className="list-disc space-y-1 pl-5 text-small text-muted">
                          {d.notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant={pick === i ? "primary" : "ghost"} size="sm" onClick={() => setPick(i)} aria-pressed={pick === i}>
                        Preview
                      </Button>
                      <CopyButton text={d.text} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {chosen && (
              <GooglePreview
                title={pageTitle.trim() || keyword.trim() || "Your page title"}
                url={`yourwebsite.com › ${keyword.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40) || "page"}`}
                description={chosen.text}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
