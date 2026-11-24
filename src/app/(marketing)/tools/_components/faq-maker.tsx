"use client";
// "Info for Google and AI" maker: questions + answers → FAQ code (FAQPage JSON-LD) to copy, plus a checker for pasted
// FAQ code (FAQ schema checker). Both run in the browser only; nothing is sent.
import { useMemo, useState } from "react";
import { Copy, FileCheck, PenLine, Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Notice, Tabs, TabPanel, Textarea } from "@/components/ui";
import { FAQ_MAX_ITEMS, faqScriptTag, type FaqItem } from "@/lib/growth/tools";
import { checkFaqSchema, FAQ_CHECK_MAX_CHARS, FAQ_GOOGLE_2023_NOTE, FAQ_SCHEMA_EXAMPLE } from "@/lib/tools/faq-schema-check";
import { CheckResults } from "./check-results";
import { WholeSiteCta } from "./whole-site-cta";

type Mode = "make" | "check";

const START: FaqItem[] = [
  { question: "", answer: "" },
  { question: "", answer: "" },
];

export function FaqMaker() {
  const [mode, setMode] = useState<Mode>("make");
  return (
    <div className="space-y-6">
      <Tabs
        label="Make or check FAQ code"
        idPrefix="faq"
        variant="pills"
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        tabs={[
          { id: "make", label: "Make FAQ code", icon: <PenLine /> },
          { id: "check", label: "Check my FAQ code", icon: <FileCheck /> },
        ]}
      />
      <TabPanel idPrefix="faq" value={mode} className="pt-0">
        {mode === "make" ? <FaqMake /> : <FaqSchemaChecker />}
      </TabPanel>
    </div>
  );
}

function FaqMake() {
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
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
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
        {code && (
          <div className="mt-4">
            <WholeSiteCta lead="This code is for one page." />
          </div>
        )}
      </div>
    </div>
  );
}

function FaqSchemaChecker() {
  const [code, setCode] = useState("");
  const result = useMemo(() => (code.trim() ? checkFaqSchema(code) : null), [code]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <Field
          label="Your FAQ code"
          htmlFor="faq-check-code"
          hint='Paste the code from your page: the JSON on its own, or the whole <script type="application/ld+json"> block. This runs in your browser; nothing is sent.'
          labelAside={
            <Button variant="link" onClick={() => setCode(FAQ_SCHEMA_EXAMPLE)}>
              Use an example
            </Button>
          }
        >
          <Textarea
            id="faq-check-code"
            rows={12}
            className="font-mono text-xs"
            value={code}
            maxLength={FAQ_CHECK_MAX_CHARS}
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
            placeholder={'<script type="application/ld+json">\n{ "@context": "https://schema.org", "@type": "FAQPage", ... }\n</script>'}
          />
        </Field>
      </div>
      <div aria-live="polite" className="space-y-4">
        {result && (
          <>
            <CheckResults title="What we found in your FAQ code" items={result.items} errors={result.errors} warnings={result.warnings} />
            <Notice tone="info">{FAQ_GOOGLE_2023_NOTE}</Notice>
            <WholeSiteCta lead="This checked one block of code." />
          </>
        )}
      </div>
    </div>
  );
}
