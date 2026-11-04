"use client";
// "Info for Google and AI" maker: questions + answers → FAQ code (FAQPage JSON-LD) to copy. Runs in the browser only.
import { useMemo, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { FAQ_MAX_ITEMS, faqScriptTag, type FaqItem } from "@/lib/growth/tools";

const START: FaqItem[] = [
  { question: "", answer: "" },
  { question: "", answer: "" },
];

export function FaqMaker() {
  const [items, setItems] = useState<FaqItem[]>(START);
  const [copied, setCopied] = useState(false);
  const code = useMemo(() => faqScriptTag(items), [items]);

  const set = (i: number, k: keyof FaqItem, v: string) => {
    setCopied(false);
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  };

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-5">
        {items.map((it, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="text-small font-semibold text-fg">Question {i + 1}</p>
              {items.length > 1 && (
                <Button variant="ghost" size="icon-sm" aria-label={`Remove question ${i + 1}`} icon={<Trash2 />} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} />
              )}
            </div>
            <Field label="What customers ask" htmlFor={`q-${i}`}>
              <Input id={`q-${i}`} placeholder="Do you deliver on Sundays?" value={it.question} maxLength={300} onChange={(e) => set(i, "question", e.target.value)} />
            </Field>
            <Field label="Your answer" htmlFor={`a-${i}`}>
              <Textarea id={`a-${i}`} rows={3} placeholder="Yes, we deliver every day from 9 am to 8 pm across Pune." value={it.answer} maxLength={2000} onChange={(e) => set(i, "answer", e.target.value)} />
            </Field>
          </div>
        ))}
        {items.length < FAQ_MAX_ITEMS && (
          <Button variant="secondary" icon={<Plus />} onClick={() => setItems((xs) => [...xs, { question: "", answer: "" }])}>
            Add a question
          </Button>
        )}
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-small font-semibold text-fg">Your code</p>
          <p className="mt-1 text-small text-muted">
            Paste it into the page that shows these questions (in WordPress: a &quot;Custom HTML&quot; block). Visitors won&apos;t see it; Google and AI will.
          </p>
          <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-4 text-xs text-fg-soft">
            {code ?? "Fill in at least one question and answer to see your code here."}
          </pre>
          <Button className="mt-4" icon={<Copy />} onClick={copy} disabled={!code}>
            {copied ? "Copied" : "Copy code"}
          </Button>
        </div>
      </div>
    </div>
  );
}
