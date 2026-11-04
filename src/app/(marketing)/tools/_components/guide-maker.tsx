"use client";
// "AI guide file" maker (llms.txt): a short file that tells AI tools who you are and which pages matter.
// Runs in the browser only.
import { useMemo, useState } from "react";
import { Copy, Download, Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { buildAiGuideFile, type GuideLink } from "@/lib/growth/tools";

export function GuideMaker() {
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [links, setLinks] = useState<GuideLink[]>([
    { title: "Home", url: "", note: "" },
    { title: "Services", url: "", note: "" },
    { title: "Contact", url: "", note: "" },
  ]);
  const [copied, setCopied] = useState(false);

  const file = useMemo(() => buildAiGuideFile({ businessName: name, summary, details, links, contact }), [name, summary, details, links, contact]);
  const setLink = (i: number, k: keyof GuideLink, v: string) => {
    setCopied(false);
    setLinks((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(file);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([file], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "llms.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
        <Field label="Business name" htmlFor="g-name">
          <Input id="g-name" placeholder="Sharma Sweets" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="What you do, in one line" htmlFor="g-summary">
          <Input id="g-summary" placeholder="Fresh Indian sweets and snacks in Jaipur since 1985, with home delivery." value={summary} maxLength={500} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <Field label="More about you" htmlFor="g-details" optional>
          <Textarea id="g-details" rows={4} placeholder="Areas you serve, opening hours, what makes you different." value={details} maxLength={3000} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <div className="space-y-3">
          <p className="text-small font-medium text-fg">Your main pages</p>
          {links.map((l, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <Input aria-label={`Page ${i + 1} name`} placeholder="Page name" value={l.title} maxLength={120} onChange={(e) => setLink(i, "title", e.target.value)} className="sm:w-36" />
              <Input aria-label={`Page ${i + 1} address`} placeholder="yoursite.com/page" value={l.url} maxLength={2048} onChange={(e) => setLink(i, "url", e.target.value)} className="sm:flex-1" />
              <Button variant="ghost" size="icon-sm" aria-label={`Remove page ${i + 1}`} icon={<Trash2 />} onClick={() => setLinks((xs) => xs.filter((_, j) => j !== i))} />
            </div>
          ))}
          {links.length < 50 && (
            <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => setLinks((xs) => [...xs, { title: "", url: "", note: "" }])}>
              Add a page
            </Button>
          )}
        </div>
        <Field label="How to reach you" htmlFor="g-contact" optional>
          <Input id="g-contact" placeholder="Call +91 98765 43210 or email hello@sharmasweets.in" value={contact} maxLength={300} onChange={(e) => setContact(e.target.value)} />
        </Field>
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-small font-semibold text-fg">Your AI guide file</p>
          <p className="mt-1 text-small text-muted">
            Save it as <code>llms.txt</code> and upload it to the main folder of your website, so it opens at yoursite.com/llms.txt.
          </p>
          <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-4 text-xs text-fg-soft">{file}</pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={<Download />} onClick={download}>
              Download file
            </Button>
            <Button variant="secondary" icon={<Copy />} onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
