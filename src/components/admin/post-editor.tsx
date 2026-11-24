"use client";
// Blog post editor with a live SEO / AEO / GEO score (same rules as the server: src/lib/content/score.ts).
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, CircleAlert, CircleX, ExternalLink, Eye, Link2, ListChecks, Plus, Save, Search, Send, Trash2, Undo2, Upload, Wand2, X } from "lucide-react";
import { Badge, Button, Dialog, Field, Input, Notice, Textarea, useToast, type Tone } from "@/components/ui";
import { Markdown } from "@/components/marketing/markdown";
import { parseMarkdown, relativizeOwnLinks, slugify } from "@/lib/content/markdown";
import type { LinkTarget } from "@/lib/content/link-targets";
import { scorePost, type Pillar } from "@/lib/content/score";
import { adminSend } from "./actions";
import type { EditorPost } from "@/lib/content/editor-defaults";

export type { EditorPost } from "@/lib/content/editor-defaults";

/** Live slug clean-up that still lets people type dashes and spaces ("my post" → "my-post"). */
const typingSlug = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 100);
const MAX_KEYWORDS = 15;

const scoreTone = (s: number): Tone => (s >= 75 ? "success" : s >= 50 ? "warning" : "danger");
const PILLAR_NAME: Record<Pillar, string> = { seo: "SEO", aeo: "AEO", geo: "GEO" };
/** Sort order in the checks popup: missing first, then "improve", then passing. */
const STATE_ORDER = { fail: 0, warn: 1, pass: 2 } as const;

export function PostEditor({
  initial,
  canPublish,
  canWrite = true,
  siteUrl,
  linkTargets = [],
}: {
  initial: EditorPost;
  /** Our pages for the "Link to our page" picker (src/lib/content/link-targets.ts). */
  linkTargets?: LinkTarget[];
  canPublish: boolean;
  /** false = read-only view (role has content.view only). */
  canWrite?: boolean;
  siteUrl: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<EditorPost>(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kwDraft, setKwDraft] = useState("");
  const live = initial.status === "published";

  // ---- links in the article: "Link to our page" picker, outside link, and fixing full mywebrank.tech links
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkText, setLinkText] = useState("");
  /** Remember where the cursor / selection is in the article and return the selected words. */
  const rememberSelection = () => {
    const el = bodyRef.current;
    selection.current = el ? { start: el.selectionStart, end: el.selectionEnd } : { start: p.body.length, end: p.body.length };
    return p.body.slice(selection.current.start, selection.current.end).trim();
  };
  /** Replace the remembered selection with `text`, then select `selectFrom..selectTo` (offsets inside `text`). */
  const insertAtSelection = (text: string, selectFrom = text.length, selectTo = text.length) => {
    const { start, end } = selection.current;
    set("body", p.body.slice(0, start) + text + p.body.slice(end));
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + selectFrom, start + selectTo);
    });
  };
  const openLinkPicker = () => {
    setLinkText(rememberSelection());
    setLinkQuery("");
    setLinkOpen(true);
  };
  const insertOwnLink = (t: LinkTarget) => {
    const words = linkText.trim() || t.title;
    insertAtSelection(`[${words}](${t.path})`);
    setLinkOpen(false);
    toast(`Linked to ${t.path}`, "success");
  };
  const insertOutsideLink = () => {
    const words = rememberSelection() || "source name";
    const md = `[${words}](https://)`;
    // Select "https://" so the writer can paste the address straight away.
    insertAtSelection(md, words.length + 3, md.length - 1);
  };
  const ownFullLinks = useMemo(() => relativizeOwnLinks(p.body).changed, [p.body]);
  const fixOwnLinks = () => {
    const r = relativizeOwnLinks(p.body);
    set("body", r.body);
    toast(`${r.changed} link${r.changed === 1 ? "" : "s"} shortened to our own pages`, "success");
  };
  const filteredTargets = useMemo(() => {
    const q = linkQuery.trim().toLowerCase();
    return q ? linkTargets.filter((t) => t.title.toLowerCase().includes(q) || t.path.toLowerCase().includes(q)) : linkTargets;
  }, [linkQuery, linkTargets]);

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
  const [checksOpen, setChecksOpen] = useState(false);
  const toFix = score.checks.filter((c) => c.state !== "pass");

  /** Keywords incl. one typed but not yet committed with Enter; case-insensitive de-dupe, max ${MAX_KEYWORDS}. */
  function keywordList() {
    const all = [...p.keywords, kwDraft].map((k) => k.trim().slice(0, 100)).filter(Boolean);
    const seen = new Set<string>();
    return all.filter((k) => !seen.has(k.toLowerCase()) && seen.add(k.toLowerCase())).slice(0, MAX_KEYWORDS);
  }

  function payload() {
    return {
      title: p.title,
      metaTitle: p.metaTitle.trim() || null,
      slug: p.slug.replace(/-+$/, ""),
      description: p.description,
      answer: p.answer,
      body: p.body,
      keyPoints: p.keyPoints.map((k) => k.trim()).filter(Boolean),
      faqs: p.faqs.filter((f) => f.q.trim() && f.a.trim()),
      keywords: keywordList(),
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
        if (!created) throw new Error("The post could not be created. Please try again.");
        // Remember the id straight away: if the status change below fails, the next click updates this post
        // instead of creating a duplicate.
        setP((x) => ({ ...x, id: created.id }));
        setKwDraft("");
        if (status && status !== "draft") {
          try {
            await adminSend(`/api/admin/content/${created.id}`, "PATCH", { status });
          } catch (e) {
            router.replace(`/admin/content/${created.id}`);
            throw new Error(`Saved as a draft, but: ${(e as Error).message}`);
          }
        }
        toast(status === "published" ? "Published" : status === "review" ? "Sent for review" : "Draft saved", "success");
        router.replace(`/admin/content/${created.id}`);
      } else {
        await adminSend(`/api/admin/content/${p.id}`, "PATCH", { ...payload(), ...(status ? { status } : {}) });
        setKwDraft("");
        set("keywords", keywordList());
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
  const rawTitle = p.metaTitle.trim() || p.title || "Your post title";
  const serpTitle = rawTitle.length > 48 ? rawTitle : `${rawTitle} · MyWebRank`;

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
                readOnly={!!initial.slugLocked}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", typingSlug(e.target.value));
                }}
                onBlur={() => set("slug", p.slug.replace(/-+$/, ""))}
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
                    set("keywords", keywordList());
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
              {canWrite ? (
                <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Article tools">
                  <Button type="button" size="xs" variant="secondary" icon={<Link2 />} onClick={openLinkPicker} title="Select words in the article first, then pick one of our pages">
                    Link to our page
                  </Button>
                  <Button type="button" size="xs" variant="ghost" icon={<ExternalLink />} onClick={insertOutsideLink} title="Link a study, docs or data source">
                    Outside link
                  </Button>
                  <span className="text-xs text-muted">
                    Links to our pages:{" "}
                    <strong className={score.stats.internalLinks >= 2 ? "text-success" : "text-danger"}>{score.stats.internalLinks}</strong> (aim for 2+)
                  </span>
                </div>
              ) : null}
              {canWrite && ownFullLinks > 0 ? (
                <Notice tone="info" title={`${ownFullLinks} link${ownFullLinks === 1 ? "" : "s"} use the full mywebrank.tech address`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span>They already count as links to our pages. Shorten them (/pricing) so they also work in previews.</span>
                    <Button type="button" size="xs" variant="secondary" icon={<Wand2 />} onClick={fixOwnLinks}>
                      Shorten them
                    </Button>
                  </div>
                </Notice>
              ) : null}
              <Textarea
                ref={bodyRef}
                aria-label="Article (Markdown)"
                rows={24}
                className="font-mono text-small"
                value={p.body}
                onChange={(e) => set("body", e.target.value)}
              />
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
            {!canWrite && <p className="text-xs text-muted">Read-only: your role can view posts but not edit them.</p>}
            {canWrite && (!live || canPublish) && (
              <Button variant="secondary" icon={<Save />} loading={busy === "save"} onClick={() => save()}>
                {live ? "Save changes (stays live)" : "Save draft"}
              </Button>
            )}
            {canWrite && !live && p.status !== "review" && p.status !== "archived" && (
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
                href={`/blog/${initial.slug}/preview`}
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
          {toFix.length > 0 ? (
            <p className="flex items-center gap-1.5 text-small text-fg">
              <CircleAlert aria-hidden className="size-4 shrink-0 text-warning" />
              {toFix.length} {toFix.length === 1 ? "thing" : "things"} to improve
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-small text-fg">
              <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" /> Every check passes
            </p>
          )}
          <Button variant="secondary" fullWidth icon={<ListChecks />} onClick={() => setChecksOpen(true)}>
            See all checks
          </Button>
        </div>
      </aside>

      <Dialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Link to our page"
        description="Pick a page. The link goes where your cursor was in the article; selected words become the link text."
        size="lg"
        icon={<Link2 />}
      >
        <div className="space-y-3">
          <Field label="Link text (descriptive words, not “click here”)" htmlFor="link-text">
            <Input id="link-text" value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="e.g. free website check" />
          </Field>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              aria-label="Search our pages"
              className="pl-9"
              value={linkQuery}
              onChange={(e) => setLinkQuery(e.target.value)}
              placeholder="Search pages, tools, guides, posts"
            />
          </div>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {filteredTargets.length === 0 ? (
              <p className="text-small text-muted">No page matches. You can still type a link like [words](/pricing) in the article.</p>
            ) : (
              (["Main pages", "Free tools", "Guides", "Blog posts"] as const).map((g) => {
                const items = filteredTargets.filter((t) => t.group === g);
                if (!items.length) return null;
                return (
                  <section key={g}>
                    <h3 className="mb-1 text-caption font-semibold uppercase tracking-[0.06em] text-muted">{g}</h3>
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {items.map((t) => (
                        <li key={t.path}>
                          <button
                            type="button"
                            onClick={() => insertOwnLink(t)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-small hover:bg-surface-2"
                          >
                            <span className="truncate font-medium text-fg">{t.title}</span>
                            <code className="shrink-0 text-xs text-muted">{t.path}</code>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={checksOpen}
        onClose={() => setChecksOpen(false)}
        title={`Content score · ${score.overall}/100`}
        description={`${score.stats.words} words · ${score.stats.readingMinutes} min read · ${score.stats.internalLinks} internal / ${score.stats.externalLinks} outside links. Updates live as you edit.`}
        size="xl"
        icon={<ListChecks />}
      >
        <div className="grid gap-6 md:grid-cols-3">
          {(Object.keys(score.pillars) as Pillar[]).map((pillar) => {
            const checks = score.checks
              .filter((c) => c.pillar === pillar)
              // Things to fix first, then the ones that already pass.
              .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
            return (
              <section key={pillar} aria-labelledby={`checks-${pillar}`} className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 id={`checks-${pillar}`} className="text-small font-semibold text-fg">
                    {PILLAR_NAME[pillar]}
                  </h3>
                  <Badge tone={scoreTone(score.pillars[pillar])}>{score.pillars[pillar]}/100</Badge>
                </div>
                <ul className="space-y-2.5">
                  {checks.map((c) => (
                    <li key={c.id} className="flex gap-2 text-small">
                      {c.state === "pass" ? (
                        <CheckCircle2 aria-label="Pass" className="mt-0.5 size-4 shrink-0 text-success" />
                      ) : c.state === "warn" ? (
                        <CircleAlert aria-label="Improve" className="mt-0.5 size-4 shrink-0 text-warning" />
                      ) : (
                        <CircleX aria-label="Missing" className="mt-0.5 size-4 shrink-0 text-danger" />
                      )}
                      <span className={c.state === "pass" ? "text-fg-soft" : "text-fg"}>
                        {c.label}
                        {c.state !== "pass" && <span className="mt-0.5 block text-xs text-muted">{c.tip}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Dialog>
    </div>
  );
}
