"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, ExternalLink, ListPlus, Search } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import {
  linkTaskDescription,
  linkTaskTitle,
  suggestionsToCsv,
  type LinkStrength,
  type LinkSuggestion,
} from "@/lib/links/suggest";
import { Badge, Button, EmptyState, Field, Input, Select, Table, TD, TH, THead, TR, useToast } from "@/components/ui";

type StrengthFilter = "all" | "needy" | "orphan";

const STRENGTH_BADGE: Record<LinkStrength, { tone: "danger" | "warning" | "neutral"; label: string }> = {
  orphan: { tone: "danger", label: "No links in" },
  weak: { tone: "warning", label: "1 link in" },
  ok: { tone: "neutral", label: "Linked" },
};

function pathOf(u: string): string {
  try {
    const x = new URL(u);
    return `${x.pathname}${x.search}` || "/";
  } catch {
    return u;
  }
}

function PageRef({ label, url }: { label: string; url: string }) {
  return (
    <span className="block min-w-0">
      <span className="block font-medium text-fg">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1 text-xs text-muted hover:text-fg hover:underline"
      >
        <span className="truncate">{pathOf(url)}</span>
        <ExternalLink size={11} aria-hidden className="shrink-0" />
        <span className="sr-only">(opens in new tab)</span>
      </a>
    </span>
  );
}

function Snippet({ s }: { s: LinkSuggestion }) {
  return (
    <span className="text-small text-fg-soft">
      {s.snippet.before}
      <mark className="rounded bg-warning-soft px-0.5 font-semibold text-fg">{s.snippet.match}</mark>
      {s.snippet.after}
    </span>
  );
}

function AddToTodo({
  projectId,
  s,
  added,
  canEdit,
  onAdded,
}: {
  projectId: string;
  s: LinkSuggestion;
  added: boolean;
  canEdit: boolean;
  onAdded: (title: string) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (added) {
    return (
      <Link href={`/app/projects/${projectId}/todo`} className="inline-flex items-center gap-1 text-small font-medium text-success hover:underline">
        <CheckCircle2 size={14} aria-hidden /> In your to-do
      </Link>
    );
  }
  if (!canEdit) return null;
  async function add() {
    setBusy(true);
    try {
      const title = linkTaskTitle(s);
      await api(`/api/projects/${projectId}/tasks`, {
        body: {
          title,
          description: linkTaskDescription(s),
          category: "content",
          priority: s.targetStrength === "orphan" ? "high" : "medium",
          performedBy: "client",
          evidence: { links: [s.sourceUrl, s.targetUrl] },
        },
      });
      onAdded(title);
      toast("Added to your to-do list.", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="outline" icon={<ListPlus />} onClick={add} loading={busy}>
      Add to my to-do
    </Button>
  );
}

export function LinkSuggestions({
  projectId,
  host,
  suggestions,
  existingTaskTitles,
  canEdit,
  initialTarget,
}: {
  projectId: string;
  host: string;
  suggestions: LinkSuggestion[];
  existingTaskTitles: string[];
  canEdit: boolean;
  initialTarget?: string;
}) {
  const [q, setQ] = useState("");
  const [strength, setStrength] = useState<StrengthFilter>("all");
  const [target, setTarget] = useState(initialTarget && suggestions.some((s) => s.targetUrl === initialTarget) ? initialTarget : "");
  const [added, setAdded] = useState(() => new Set(existingTaskTitles));

  const targets = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of suggestions) if (!m.has(s.targetUrl)) m.set(s.targetUrl, s.targetLabel);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [suggestions]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return suggestions.filter((s) => {
      if (strength === "orphan" && s.targetStrength !== "orphan") return false;
      if (strength === "needy" && s.targetStrength === "ok") return false;
      if (target && s.targetUrl !== target) return false;
      if (!needle) return true;
      return [s.sourceLabel, s.sourceUrl, s.targetLabel, s.targetUrl, s.anchor].some((x) => x.toLowerCase().includes(needle));
    });
  }, [suggestions, q, strength, target]);

  function downloadCsv() {
    const blob = new Blob(["﻿", suggestionsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `internal-link-suggestions-${host || "site"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const onAdded = (title: string) => setAdded((prev) => new Set(prev).add(title));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-end">
        <Field label="Search" htmlFor="links-q">
          <div className="relative">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input id="links-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Page name, address or words" className="pl-9" />
          </div>
        </Field>
        <Field label="Show" htmlFor="links-strength">
          <Select id="links-strength" value={strength} onChange={(e) => setStrength(e.target.value as StrengthFilter)}>
            <option value="all">All suggestions</option>
            <option value="needy">Pages with 0–1 links in</option>
            <option value="orphan">Pages with no links in</option>
          </Select>
        </Field>
        <Field label="Page that needs links" htmlFor="links-target">
          <Select id="links-target" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Any page</option>
            {targets.map(([url, label]) => (
              <option key={url} value={url}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="outline" icon={<Download />} onClick={downloadCsv} disabled={!rows.length}>
          Download CSV
        </Button>
      </div>

      <p className="text-small text-muted" aria-live="polite">
        Showing {rows.length} of {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"}.
      </p>

      {rows.length === 0 ? (
        <EmptyState size="sm" bordered picture="search" title="No suggestions match these filters." />
      ) : (
        <>
          {/* Phone: one card per suggestion. */}
          <ul className="space-y-3 md:hidden">
            {rows.map((s) => (
              <li key={s.id} className="space-y-2 rounded-xl border border-border bg-surface p-4">
                <p className="text-small font-medium text-fg">{s.sentence}</p>
                <p className="rounded-lg bg-surface-2 p-2">
                  <Snippet s={s} />
                </p>
                <p className="text-xs text-muted">{s.why}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STRENGTH_BADGE[s.targetStrength].tone}>{STRENGTH_BADGE[s.targetStrength].label}</Badge>
                  <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted underline">
                    Open the page to edit
                  </a>
                  <span className="ml-auto">
                    <AddToTodo projectId={projectId} s={s} added={added.has(linkTaskTitle(s))} canEdit={canEdit} onAdded={onAdded} />
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* Wider screens: table. */}
          <div className="hidden md:block">
            <Table framed caption="Internal link suggestions">
              <THead>
                <tr>
                  <TH>Add a link on</TH>
                  <TH>Pointing to</TH>
                  <TH>Using the words</TH>
                  <TH>Where on the page</TH>
                  <TH>Why</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <tbody>
                {rows.map((s) => (
                  <TR key={s.id}>
                    <TD className="min-w-40">
                      <PageRef label={s.sourceLabel} url={s.sourceUrl} />
                    </TD>
                    <TD className="min-w-40">
                      <PageRef label={s.targetLabel} url={s.targetUrl} />
                      <Badge tone={STRENGTH_BADGE[s.targetStrength].tone} className="mt-1">
                        {STRENGTH_BADGE[s.targetStrength].label}
                      </Badge>
                    </TD>
                    <TD className="min-w-32 font-semibold text-fg">“{s.anchor}”</TD>
                    <TD className="min-w-64 max-w-md">
                      <Snippet s={s} />
                    </TD>
                    <TD className="min-w-56 max-w-sm text-small">{s.why}</TD>
                    <TD className="whitespace-nowrap">
                      <AddToTodo projectId={projectId} s={s} added={added.has(linkTaskTitle(s))} canEdit={canEdit} onAdded={onAdded} />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
