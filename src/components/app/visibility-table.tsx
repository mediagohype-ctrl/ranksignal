"use client";
import { Fragment, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, ExternalLink, Info, Minus, Search } from "lucide-react";
import { Badge, Button, EmptyState, Input, Select, Table, TD, TH, THead, TR, Tooltip } from "@/components/ui";

export interface ObservationRow {
  id: string;
  prompt: string;
  provider: string;
  platformLabel: string;
  model: string | null;
  brandMentioned: boolean;
  brandCited: boolean;
  brandRecommended: boolean;
  competitorMentions: Record<string, number>;
  sentiment: string | null;
  parseConfidence: number;
  rawResponse: string;
  citations: { url: string; domain: string; title?: string; ownedByCustomer: boolean }[];
  limitations: string | null;
  simulated: boolean;
}

type ResultFilter = "all" | "mentioned" | "not_mentioned" | "cited" | "recommended";
const FILTERS: { id: ResultFilter; label: string }[] = [
  { id: "all", label: "All answers" },
  { id: "mentioned", label: "Mentions you" },
  { id: "not_mentioned", label: "Doesn't mention you" },
  { id: "cited", label: "Links to your site" },
  { id: "recommended", label: "Recommends you" },
];

/** Column header with a small "what does this mean?" tooltip. */
function HelpTH({ children, help, align }: { children: React.ReactNode; help: string; align?: "left" | "right" | "center" }) {
  return (
    <TH align={align}>
      <span className="inline-flex items-center gap-1">
        {children}
        <Tooltip content={help}>
          <button type="button" aria-label={`What is “${String(children)}”?`} className="focus-ring rounded text-muted hover:text-fg">
            <Info aria-hidden size={13} />
          </button>
        </Tooltip>
      </span>
    </TH>
  );
}

function YesNo({ v, label }: { v: boolean; label: string }) {
  return v ? (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-success-soft text-success">
      <Check aria-hidden size={14} strokeWidth={3} />
      <span className="sr-only">Yes, {label}</span>
    </span>
  ) : (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-2 text-muted">
      <Minus aria-hidden size={14} />
      <span className="sr-only">Not {label}</span>
    </span>
  );
}

function Citations({ title, items, owned }: { title: string; items: ObservationRow["citations"]; owned: boolean }) {
  return (
    <div>
      <h5 className="mb-1.5 flex items-center gap-2 text-caption uppercase tracking-[0.06em] text-muted">
        {title} <span className="tabular-nums">({items.length})</span>
      </h5>
      {items.length === 0 ? (
        <p className="text-xs text-muted">{owned ? "No pages from your site were cited." : "No other websites were cited."}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((c, i) => (
            <li key={`${c.url}-${i}`} className={clsx("rounded-lg px-2.5 py-1.5", owned ? "bg-accent-soft" : "bg-surface")}>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex max-w-full items-start gap-1 text-small text-primary hover:underline"
              >
                <span className="min-w-0 break-all">{c.title || c.url}</span>
                <ExternalLink size={11} className="mt-1 shrink-0" aria-hidden />
                <span className="sr-only">(opens in new tab)</span>
              </a>
              <div className="text-xs text-muted">{c.domain}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VisibilityTable({ rows }: { rows: ObservationRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("all");
  const [filter, setFilter] = useState<ResultFilter>("all");
  const providers = useMemo(() => Array.from(new Set(rows.map((r) => r.platformLabel))), [rows]);
  const counts = useMemo(() => {
    const base = rows.filter((r) => provider === "all" || r.platformLabel === provider);
    return {
      all: base.length,
      mentioned: base.filter((r) => r.brandMentioned).length,
      not_mentioned: base.filter((r) => !r.brandMentioned).length,
      cited: base.filter((r) => r.brandCited).length,
      recommended: base.filter((r) => r.brandRecommended).length,
    } satisfies Record<ResultFilter, number>;
  }, [rows, provider]);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (provider === "all" || r.platformLabel === provider) &&
      (filter === "all" ||
        (filter === "mentioned" && r.brandMentioned) ||
        (filter === "not_mentioned" && !r.brandMentioned) ||
        (filter === "cited" && r.brandCited) ||
        (filter === "recommended" && r.brandRecommended)) &&
      (!needle || r.prompt.toLowerCase().includes(needle)),
  );
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const COLS = 7;

  return (
    <div>
      <div className="space-y-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search aria-hidden size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <label className="sr-only" htmlFor="vt-q">Search questions</label>
            <Input id="vt-q" inputSize="sm" placeholder="Search questions…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          {providers.length > 1 && (
            <>
              <label className="sr-only" htmlFor="vt-p">AI assistant</label>
              <Select id="vt-p" inputSize="sm" value={provider} onChange={(e) => setProvider(e.target.value)} className="max-w-56">
                <option value="all">All AI assistants</option>
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </>
          )}
          <span className="ml-auto text-xs tabular-nums text-muted" aria-live="polite">
            {shown.length} of {rows.length} answers
          </span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter answers">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                "focus-ring inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-small font-medium transition-colors",
                filter === f.id ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface text-fg-soft hover:bg-surface-2",
              )}
            >
              {f.label}
              <span className="text-xs tabular-nums opacity-80">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState size="sm" title="No answers match" description="Try a different filter or search." />
      ) : (
        <Table caption="AI answers to your tracked questions">
          <THead>
            <tr>
              <TH>Question asked</TH>
              <TH>AI assistant</TH>
              <HelpTH help="The answer named your brand." align="center">Mentioned</HelpTH>
              <HelpTH help="The answer linked to a page on your website as a source." align="center">Linked</HelpTH>
              <HelpTH help="The answer actively suggested you as a good choice." align="center">Recommended</HelpTH>
              <HelpTH help="Competitors from your project that the answer named.">Competitors</HelpTH>
              <TH>
                <span className="sr-only">Show answer</span>
              </TH>
            </tr>
          </THead>
          <tbody>
            {shown.map((r) => {
              const isOpen = open.has(r.id);
              const comps = Object.entries(r.competitorMentions).filter(([, n]) => n > 0);
              const owned = r.citations.filter((c) => c.ownedByCustomer);
              const third = r.citations.filter((c) => !c.ownedByCustomer);
              return (
                <Fragment key={r.id}>
                  <TR className={isOpen ? "bg-surface-2" : undefined}>
                    <TD className="max-w-md font-medium text-fg">{r.prompt}</TD>
                    <TD>
                      <div className="text-xs text-fg-soft">{r.platformLabel}</div>
                      {r.simulated && (
                        <Badge tone="warning" size="sm" className="mt-1">
                          Simulated
                        </Badge>
                      )}
                    </TD>
                    <TD align="center"><YesNo v={r.brandMentioned} label="mentioned" /></TD>
                    <TD align="center"><YesNo v={r.brandCited} label="linked to your site" /></TD>
                    <TD align="center"><YesNo v={r.brandRecommended} label="recommended" /></TD>
                    <TD className="text-xs">
                      {comps.length ? (
                        <span className="flex flex-wrap gap-1">
                          {comps.map(([n, c]) => (
                            <Badge key={n} size="sm">
                              {n}
                              {c > 1 ? ` ×${c}` : ""}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted">None</span>
                      )}
                    </TD>
                    <TD align="right">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => toggle(r.id)}
                        aria-expanded={isOpen}
                        aria-controls={`obs-${r.id}`}
                        iconRight={<ChevronDown className={clsx("transition-transform", isOpen && "rotate-180")} />}
                      >
                        {isOpen ? "Hide" : "Answer"}
                      </Button>
                    </TD>
                  </TR>
                  {isOpen && (
                    <tr id={`obs-${r.id}`} className="border-b border-border bg-surface-2">
                      <td colSpan={COLS} className="px-5 py-5 sm:px-6">
                        <div className="grid gap-6 lg:grid-cols-5">
                          <div className="lg:col-span-3">
                            <h4 className="mb-1.5 text-caption uppercase tracking-[0.06em] text-muted">
                              What {r.platformLabel} answered
                              {r.model && <span className="font-normal normal-case tracking-normal"> · {r.model}</span>}
                            </h4>
                            {/* Untrusted provider text: rendered as plain text only. */}
                            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-surface p-4 text-small leading-relaxed text-fg-soft">
                              {r.rawResponse || <span className="text-muted">(empty answer)</span>}
                            </div>
                            <p className="mt-2 text-xs text-muted">
                              {r.sentiment && <>Tone towards you: <span className="capitalize">{r.sentiment}</span> · </>}
                              How sure we are about this reading: {Math.round(r.parseConfidence * 100)}%
                              {r.parseConfidence < 0.6 && <span className="text-warning"> (low — double-check the answer)</span>}
                            </p>
                            {r.limitations && <p className="mt-1 text-xs text-muted">Note: {r.limitations}</p>}
                          </div>
                          <div className="space-y-5 lg:col-span-2">
                            <Citations title="Your website" items={owned} owned />
                            <Citations title="Other websites" items={third} owned={false} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
