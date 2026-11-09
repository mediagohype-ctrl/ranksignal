"use client";
// Free AI FAQ generator: a page address or pasted text → POST /api/public/tools/faq-generator → 6–8 editable
// Q&A drafts grounded in that text → ready-to-paste FAQPage JSON-LD (built in the browser from the edited rows).
import { useRef, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge, Button, Card, Field, Input, Notice, Textarea } from "@/components/ui";
import { AI_INPUT_LIMITS as L, evaluateFaqAnswer, isNotStated } from "@/lib/tools/ai-writing-checks";
import { faqScriptTag, type FaqItem } from "@/lib/growth/tools";
import { AiDraftNotice, CheckBadge, CopyButton, useAiTool } from "./ai-tool-form";

type Mode = "url" | "text";
interface FaqResult {
  faqs: { question: string; answer: string; notStated: boolean }[];
  sourceUrl: string | null;
}

export function FaqGenerator() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [audience, setAudience] = useState("");
  const [location, setLocation] = useState("");
  const [rows, setRows] = useState<FaqItem[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  const { run, busy, error, setError, captchaNode } = useAiTool<FaqResult>("/api/public/tools/faq-generator", "faq_generator");

  // Only finished rows go into the code: unanswered "Not stated" rows must be filled in first.
  const ready = rows.filter((r) => r.question.trim() && r.answer.trim() && !isNotStated(r.answer));
  const code = faqScriptTag(ready);
  const missing = rows.filter((r) => isNotStated(r.answer)).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "url" ? !url.trim() : text.trim().length < 30) {
      setError(mode === "url" ? "Type the address of the page, like yourbusiness.com/services." : "Paste your page text or describe the topic in at least a sentence.");
      return;
    }
    const item = await run(mode === "url" ? { url, audience, location } : { text, audience, location });
    if (item) {
      setRows(item.faqs.map((f) => ({ question: f.question, answer: f.answer })));
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const set = (i: number, k: keyof FaqItem, v: string) => setRows((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <div className="space-y-8">
      <Card variant="elevated" padding="lg" className="mx-auto max-w-2xl">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <fieldset>
            <legend className="text-small font-medium text-fg">Where should the questions come from?</legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
              {(["url", "text"] as const).map((m) => (
                <Button key={m} type="button" size="sm" variant={mode === m ? "primary" : "secondary"} aria-pressed={mode === m} onClick={() => setMode(m)} disabled={busy}>
                  {m === "url" ? "A page on my website" : "Paste text or a topic"}
                </Button>
              ))}
            </div>
          </fieldset>
          {mode === "url" ? (
            <Field label="Page address" htmlFor="fg-url" hint="A public page, e.g. yourbusiness.com/services. We read its main text only.">
              <Input id="fg-url" type="text" inputMode="url" placeholder="yourbusiness.com/services" value={url} maxLength={2048} onChange={(e) => setUrl(e.target.value)} disabled={busy} />
            </Field>
          ) : (
            <Field label="Page text or topic" htmlFor="fg-text" hint={`Up to ${L.pageText.toLocaleString("en-IN")} characters. Answers only use what you paste here.`}>
              <Textarea id="fg-text" rows={8} value={text} maxLength={L.pageText} onChange={(e) => setText(e.target.value)} disabled={busy} />
            </Field>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Who are your customers?" htmlFor="fg-audience" optional>
              <Input id="fg-audience" placeholder="First-time home buyers" value={audience} maxLength={L.audience} onChange={(e) => setAudience(e.target.value)} disabled={busy} />
            </Field>
            <Field label="Location" htmlFor="fg-location" optional>
              <Input id="fg-location" placeholder="Bengaluru" value={location} maxLength={L.location} onChange={(e) => setLocation(e.target.value)} disabled={busy} />
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
            <Button type="submit" size="lg" loading={busy} loadingText="Writing questions…" icon={<Sparkles />}>
              {rows.length ? "Write new questions" : "Write FAQ drafts"}
            </Button>
          </div>
        </form>
      </Card>

      <div ref={resultRef} className="scroll-mt-24 space-y-5" aria-live="polite">
        {rows.length > 0 && (
          <>
            <div className="mx-auto max-w-3xl">
              <AiDraftNotice>
                Answers only use your page text. Where it says &quot;Not stated on the page&quot;, write the real answer or remove the question.
              </AiDraftNotice>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-5">
                {rows.map((r, i) => {
                  const check = evaluateFaqAnswer(r.answer);
                  return (
                    <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-small font-semibold text-fg">Question {i + 1}</p>
                        <div className="flex items-center gap-2">
                          {isNotStated(r.answer) ? <Badge tone="warning">Needs your answer</Badge> : <CheckBadge check={check} unit="words" />}
                          <Button variant="ghost" size="icon-sm" aria-label={`Remove question ${i + 1}`} icon={<Trash2 />} onClick={() => setRows((xs) => xs.filter((_, j) => j !== i))} />
                        </div>
                      </div>
                      <Field label="Question" htmlFor={`fg-q-${i}`}>
                        <Input id={`fg-q-${i}`} value={r.question} maxLength={300} onChange={(e) => set(i, "question", e.target.value)} />
                      </Field>
                      <Field label="Answer" htmlFor={`fg-a-${i}`} hint={check.notes[0]}>
                        <Textarea id={`fg-a-${i}`} rows={4} value={r.answer} maxLength={2000} onChange={(e) => set(i, "answer", e.target.value)} />
                      </Field>
                    </div>
                  );
                })}
                <Button variant="secondary" icon={<Plus />} onClick={() => setRows((xs) => [...xs, { question: "", answer: "" }])}>
                  Add a question
                </Button>
              </div>
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <p className="text-small font-semibold text-fg">Your FAQ code (FAQPage JSON-LD)</p>
                  <p className="mt-1 text-small text-muted">
                    Publish the same questions and answers as visible text on the page first. Google requires the code to match what visitors can read.
                  </p>
                  {missing > 0 && (
                    <Notice tone="warning" className="mt-3">
                      {missing} {missing === 1 ? "question still needs" : "questions still need"} your answer and {missing === 1 ? "is" : "are"} left out of the code.
                    </Notice>
                  )}
                  <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-4 text-xs text-fg-soft">
                    {code ?? "Answer at least one question to see your code here."}
                  </pre>
                  <div className="mt-4">
                    <CopyButton text={code ?? ""} label="Copy code" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
