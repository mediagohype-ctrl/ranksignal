"use client";
// Blog post editor with a live SEO / AEO / GEO score (same rules as the server: src/lib/content/score.ts).
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, CircleAlert, CircleX, Eye, Plus, Save, Send, Trash2, Undo2, Upload, X } from "lucide-react";
import { Badge, Button, Field, Input, Notice, Textarea, useToast, type Tone } from "@/components/ui";
import { Markdown } from "@/components/marketing/markdown";
import { parseMarkdown, slugify } from "@/lib/content/markdown";
import { scorePost, type Pillar } from "@/lib/content/score";
import { adminSend } from "./actions";

export interface EditorPost {
  id?: string;
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  answer: string;
  body: string;
  keyPoints: string[];
  faqs: { q: string; a: string }[];
  keywords: string[];
  category: string;
  coverImageUrl: string;
  authorName: string;
  noindex: boolean;
  status: string;
}

const STARTER_BODY = `## What is [topic]?

Explain the idea in plain words. Link to a related page like [our free website check](/free-check).

## Why does it matter?

Give 2–3 specific facts or numbers, and link the source you used.

## How do you do it? (step by step)

1. First step
2. Second step
3. Third step

## [Topic] vs [alternative]

| | Option A | Option B |
|---|---|---|
| Best for | … | … |
| Cost | … | … |
`;

export const emptyPost = (authorName: string): EditorPost => ({
  slug: "",
  title: "",
  metaTitle: "",
  description: "",
  answer: "",
  body: STARTER_BODY,
  keyPoints: ["", "", ""],
  faqs: [
    { q: "", a: "" },
    { q: "", a: "" },
    { q: "", a: "" },
  ],
  keywords: [],
  category: "SEO",
  coverImageUrl: "",
  authorName,
  noindex: false,
  status: "draft",
});

const scoreTone = (s: number): Tone => (s >= 75 ? "success" : s >= 50 ? "warning" : "danger");
const PILLAR_NAME: Record<Pillar, string> = { seo: "SEO", aeo: "AEO", geo: "GEO" };

export function PostEditor({ initial, canPublish, siteUrl }: { initial: EditorPost; canPublish: boolean; siteUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<EditorPost>(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kwDraft, setKwDraft] = useState("");
  const live = initial.status === "published";

  const set = <K extends keyof EditorPost>(k: K, v: EditorPost[K]) => setP((x) => ({ ...x, [k]: v }));
  const blocks = useMemo(() => parseMarkdown(p.body), [p.body]);
  const score = useMemo(
    () =>
      scorePost(
        { ...p, keyPoints: p.keyPoints.filter((k) => k.trim()), faqs: p.faqs.filter((f) => f.q.trim() && f.a.trim()) },
        blocks,
      ),
    [p, blocks],
  );

  function payload() {
    return {
      title: p.title,
      metaTitle: p.metaTitle.trim() || null,
      slug: p.slug,
      description: p.description,
      answer: p.answer,
      body: p.body,
      keyPoints: p.keyPoints.map((k) => k.trim()).filter(Boolean),
      faqs: p.faqs.filter((f) => f.q.trim() && f.a.trim()),
      keywords: p.keywords,
      category: p.category,
      coverImageUrl: p.coverImageUrl.trim() || null,
      authorName: p.authorName,
      noindex: p.noindex,
    };
  }

  async function save(status?: string) {
    setBusy(status ?? "save");
    setError(null);
    try {
      if (!p.id) {
        const created = await adminSend<{ id: string }>("/api/admin/content", "POST", payload());
        if (created && status && status !== "draft") await adminSend(`/api/admin/content/${created.id}`, "PATCH", { status });
        toast(status === "published" ? "Published" : "Draft saved", "success");
        if (created) router.replace(`/admin/content/${created.id}`);
      } else {
        await adminSend(`/api/admin/content/${p.id}`, "PATCH", { ...payload(), ...(status ? { status } : {}) });
        if (status) set("status", status);
        toast(
          status === "published" ? (live ? "Live post updated" : "Published — sent to Bing via IndexNow") : status === "review" ? "Sent for review" : status === "draft" ? "Moved back to draft" : "Saved",
          "success",
        );
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!p.id || !window.confirm("Delete this post permanently?")) return;
    setBusy("delete");
    try {
      await adminSend(`/api/admin/content/${p.id}`, "DELETE", {});
      toast("Post deleted", "success");
      router.push("/admin/content");
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const titleLen = (p.metaTitle.trim() || p.title).length;
  const serpTitle = (p.metaTitle.trim() || p.title || "Your post title") + " · MyWebRank";

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-6">
        {error && <Notice tone="danger">{error}</Notice>}
        {live && !canPublish && <Notice tone="warning">This post is live. Only a publisher (SEO or Marketing role) can change it.</Notice>}

        <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-small font-semibold text-fg">Basics</h2>
          <Field label="Title (the H1 on the page)" htmlFor="pe-title">
            <Input
              id="pe-title"
              value={p.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              placeholder="What is GEO? A plain guide for small businesses"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address (slug)" htmlFor="pe-slug" hint={`${siteUrl}/blog/${p.slug || "…"}`}>
              <Input
                id="pe-slug"
                value={p.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
              />
            </Field>
            <Field label="Category" htmlFor="pe-cat">
              <Input id="pe-cat" list="pe-cats" value={p.category} onChange={(e) => set("category", e.target.value)} />
              <datalist id="pe-cats">
                {["SEO", "AEO", "GEO", "AI search", "Local SEO", "Case study", "Product news"].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>
          <Field label="Search phrases (first = main one)" htmlFor="pe-kw" hint="Press Enter to add. Use the words people type into Google.">
            <div className="flex flex-wrap items-center gap-2">
              {p.keywords.map((k, i) => (
                <Badge key={k} tone={i === 0 ? "primary" : "neutral"} size="md">
                  {k}
                  <button type="button" aria-label={`Remove ${k}`} className="ml-1" onClick={() => set("keywords", p.keywords.filter((x) => x !== k))}>
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              ))}
              <Input
                id="pe-kw"
                className="max-w-xs"
                value={kwDraft}
                onChange={(e) => setKwDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && kwDraft.trim()) {
                    e.preventDefault();
                    if (!p.keywords.includes(kwDraft.trim())) set("keywords", [...p.keywords, kwDraft.trim()]);
                    setKwDraft("");
                  }
                }}
                placeholder="what is geo"
              />
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Author" htmlFor="pe-author">
              <Input id="pe-author" value={p.authorName} onChange={(e) => set("authorName", e.target.value)} />
            </Field>
            <Field label="Cover image (https URL, 1200×630)" htmlFor="pe-cover" optional>
              <Input id="pe-cover" type="url" value={p.coverImageUrl} onChange={(e) => set("coverImageUrl", e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-small font-semibold text-fg">How it looks on Google</h2>
          <div className="rounded-xl border border-border bg-bg p-4">
            <p className="truncate text-xs text-muted">{siteUrl.replace(/^https?:\/\//, "")} › blog › {p.slug || "…"}</p>
            <p className={clsx("truncate text-[1.1rem] text-[#1a0dab]", titleLen > 60 && "underline decoration-danger decoration-wavy")}>{serpTitle}</p>
            <p className="line-clamp-2 text-small text-fg-soft">{p.description || "Your Google summary appears here."}</p>
          </div>
          <Field label={`Google headline (optional, ${titleLen}/60)`} htmlFor="pe-mt" hint="Leave empty to use the title.">
            <Input id="pe-mt" value={p.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} />
          </Field>
          <Field label={`Google summary (${p.description.length}/160)`} htmlFor="pe-desc">
            <Textarea id="pe-desc" rows={2} value={p.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-small font-semibold text-fg">Answer box &amp; key points (AEO / GEO)</h2>
          <Field label="Short answer (40–60 words) — shown first, quoted by AI Overviews and ChatGPT" htmlFor="pe-ans">
            <Textarea id="pe-ans" rows={3} value={p.answer} onChange={(e) => set("answer", e.target.value)} />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-small font-medium text-fg">Key points (facts AI can repeat)</legend>
            {p.keyPoints.map((k, i) => (
              <Input
                key={i}
                aria-label={`Key point ${i + 1}`}
                value={k}
                onChange={(e) => set("keyPoints", p.keyPoints.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
            <Button type="button" size="xs" variant="ghost" icon={<Plus />} onClick={() => set("keyPoints", [...p.keyPoints, ""])}>
              Add key point
            </Button>
          </fieldset>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-small font-semibold text-fg">Article</h2>
            <div className="flex gap-1 rounded-lg bg-surface-2 p-1 text-xs">
              {(["write", "preview"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={clsx("rounded-md px-3 py-1 font-medium", tab === t ? "bg-surface text-fg shadow-sm" : "text-muted")}
                >
                  {t === "write" ? "Write" : "Preview"}
                </button>
              ))}
            </div>
          </div>
          {tab === "write" ? (
            <>
              <Textarea aria-label="Article (Markdown)" rows={24} className="font-mono text-small" value={p.body} onChange={(e) => set("body", e.target.value)} />
              <p className="text-xs text-muted">
                Markdown: <code>## Heading</code>, <code>### Sub-heading</code>, <code>- list</code>, <code>1. steps</code>, <code>**bold**</code>,{" "}
                <code>[link text](/free-check)</code>, <code>![image description](https://…)</code>, tables with <code>| a | b |</code>.
              </p>
            </>
          ) : (
            <div className="max-w-none space-y-4 text-body leading-[1.7] text-fg-soft [&_a]:text-primary [&_a]:underline [&_h2]:mt-8 [&_h2]:text-h3 [&_h2]:text-fg [&_h3]:text-h4 [&_h3]:text-fg [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
              <Markdown blocks={blocks} />
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-small font-semibold text-fg">FAQs (become FAQ schema)</h2>
          {p.faqs.map((f, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-border p-3">
              <Input aria-label={`Question ${i + 1}`} placeholder="Question people ask" value={f.q} onChange={(e) => set("faqs", p.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
              <Textarea aria-label={`Answer ${i + 1}`} rows={2} placeholder="Direct answer, 1–3 sentences" value={f.a} onChange={(e) => set("faqs", p.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            </div>
          ))}
          <Button type="button" size="xs" variant="ghost" icon={<Plus />} onClick={() => set("faqs", [...p.faqs, { q: "", a: "" }])}>
            Add FAQ
          </Button>
        </section>

        <label className="flex items-center gap-2 text-small text-fg-soft">
          <input type="checkbox" checked={p.noindex} onChange={(e) => set("noindex", e.target.checked)} />
          Hide from Google (noindex) — e.g. for announcements you don&apos;t want ranking
        </label>
      </div>

      {/* Sidebar: actions + live score */}
      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-small font-semibold text-fg">Status</span>
            <Badge tone={p.status === "published" ? "success" : p.status === "review" ? "warning" : "neutral"}>{p.status}</Badge>
          </div>
          <div className="grid gap-2">
            {(!live || canPublish) && (
              <Button variant="secondary" icon={<Save />} loading={busy === "save"} onClick={() => save()}>
                {live ? "Save changes (stays live)" : "Save draft"}
              </Button>
            )}
            {!live && p.status !== "review" && (
              <Button variant="secondary" icon={<Send />} loading={busy === "review"} onClick={() => save("review")}>
                Send for review
              </Button>
            )}
            {canPublish && !live && (
              <Button icon={<Upload />} loading={busy === "published"} onClick={() => save("published")} disabled={score.overall < 50}>
                Publish
              </Button>
            )}
            {canPublish && !live && score.overall < 50 && <p className="text-xs text-muted">Reach a score of 50 to publish.</p>}
            {canPublish && live && (
              <Button variant="secondary" icon={<Undo2 />} loading={busy === "draft"} onClick={() => save("draft")}>
                Unpublish
              </Button>
            )}
            {p.id && (
              <a
                href={`/blog/${initial.slug}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-small font-medium text-fg hover:bg-surface-2"
              >
                <Eye className="size-4" aria-hidden /> {live ? "View live post" : "Preview on site"}
              </a>
            )}
            {canPublish && p.id && (
              <Button variant="ghost" icon={<Trash2 />} loading={busy === "delete"} onClick={remove}>
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-small font-semibold text-fg">Content score</span>
            <Badge tone={scoreTone(score.overall)} size="md">
              {score.overall}/100
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {(Object.keys(score.pillars) as Pillar[]).map((k) => (
              <div key={k} className="rounded-lg bg-surface-2 p-2">
                <p className="text-xs text-muted">{PILLAR_NAME[k]}</p>
                <p className={clsx("text-h4 font-semibold", score.pillars[k] >= 75 ? "text-success" : score.pillars[k] >= 50 ? "text-warning" : "text-danger")}>
                  {score.pillars[k]}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">
            {score.stats.words} words · {score.stats.readingMinutes} min read · {score.stats.internalLinks} internal / {score.stats.externalLinks} outside links
          </p>
          {(Object.keys(score.pillars) as Pillar[]).map((pillar) => (
            <div key={pillar}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted">{PILLAR_NAME[pillar]}</p>
              <ul className="space-y-1.5">
                {score.checks
                  .filter((c) => c.pillar === pillar)
                  .map((c) => (
                    <li key={c.id} className="flex gap-2 text-xs" title={c.tip}>
                      {c.state === "pass" ? (
                        <CheckCircle2 aria-label="Pass" className="size-3.5 shrink-0 text-success" />
                      ) : c.state === "warn" ? (
                        <CircleAlert aria-label="Improve" className="size-3.5 shrink-0 text-warning" />
                      ) : (
                        <CircleX aria-label="Missing" className="size-3.5 shrink-0 text-danger" />
                      )}
                      <span className={c.state === "pass" ? "text-fg-soft" : "text-fg"}>
                        {c.label}
                        {c.state !== "pass" && <span className="block text-muted">{c.tip}</span>}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
