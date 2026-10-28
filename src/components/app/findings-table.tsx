"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronDown, EyeOff, Lightbulb, RotateCcw, SearchCheck, Wrench } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { fmtDate } from "@/lib/dashboard/format";
import { Badge, Button, Card, EmptyState, SeverityBadge, StatusBadge, useToast } from "@/components/ui";
import { FilterChips } from "./audit/filter-chips";
import { EvidenceList } from "./audit/evidence-list";
import { SEVERITY_ORDER, categoryLabel, findingCopy } from "./audit/finding-copy";

export interface FindingRow {
  id: string;
  pageUrl: string | null;
  category: string;
  code: string;
  severity: string;
  confidence: number;
  message: string;
  evidence: Record<string, unknown> | null;
  status: string;
  detectedAt: string;
}

interface Group {
  code: string;
  category: string;
  severity: string;
  title: string;
  why: string;
  fix: string;
  rows: FindingRow[];
}

const sevRank = (s: string) => {
  const i = (SEVERITY_ORDER as readonly string[]).indexOf(s);
  return i === -1 ? SEVERITY_ORDER.length : i;
};

const PAGE_LIMIT = 15;

/** Audit findings grouped by rule, with plain-English explanations, filters and per-page ignore/restore. */
export function FindingsTable({ projectId, rows, canEdit }: { projectId: string; rows: FindingRow[]; canEdit: boolean }) {
  const [severity, setSeverity] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("open");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const byStatus = useMemo(() => rows.filter((r) => status === "all" || r.status === status), [rows, status]);
  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);

  const count = (pred: (r: FindingRow) => boolean, base: FindingRow[]) => base.filter(pred).length;
  const sevBase = byStatus.filter((r) => category === "all" || r.category === category);
  const catBase = byStatus.filter((r) => severity === "all" || r.severity === severity);
  const statusBase = rows.filter((r) => (severity === "all" || r.severity === severity) && (category === "all" || r.category === category));

  const groups = useMemo(() => {
    const shown = byStatus.filter((r) => (severity === "all" || r.severity === severity) && (category === "all" || r.category === category));
    const map = new Map<string, Group>();
    for (const r of shown) {
      let g = map.get(r.code);
      if (!g) {
        const c = findingCopy(r.code, r.message);
        g = { code: r.code, category: r.category, severity: r.severity, ...c, rows: [] };
        map.set(r.code, g);
      }
      g.rows.push(r);
      if (sevRank(r.severity) < sevRank(g.severity)) g.severity = r.severity;
    }
    return Array.from(map.values()).sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || b.rows.length - a.rows.length);
  }, [byStatus, severity, category]);

  const totalShown = groups.reduce((n, g) => n + g.rows.length, 0);
  const allOpen = groups.length > 0 && groups.every((g) => expanded.has(g.code));

  function toggle(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-3">
        <FilterChips
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "Open", count: count((r) => r.status === "open", statusBase) },
            { value: "ignored", label: "Ignored", count: count((r) => r.status === "ignored", statusBase) },
            { value: "resolved", label: "Fixed", count: count((r) => r.status === "resolved", statusBase) },
            { value: "all", label: "All", count: statusBase.length },
          ]}
        />
        <FilterChips
          label="Severity"
          value={severity}
          onChange={setSeverity}
          options={[
            { value: "all", label: "All", count: sevBase.length },
            ...SEVERITY_ORDER.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1), count: count((r) => r.severity === s, sevBase) })),
          ]}
        />
        {categories.length > 1 && (
          <FilterChips
            label="Area"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "All", count: catBase.length },
              ...categories.map((c) => ({ value: c, label: categoryLabel(c), count: count((r) => r.category === c, catBase) })),
            ]}
          />
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-small text-muted" aria-live="polite">
          {groups.length} {groups.length === 1 ? "problem" : "problems"} across {totalShown} {totalShown === 1 ? "page check" : "page checks"}
        </p>
        {groups.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(allOpen ? new Set() : new Set(groups.map((g) => g.code)))}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          bordered
          icon={<SearchCheck />}
          title={rows.length === 0 ? "No problems found yet" : status === "open" ? "Nothing open here" : "No findings match these filters"}
          description={
            rows.length === 0
              ? "Run an audit and we'll check every page we can reach for issues that affect search engines and AI assistants."
              : status === "open"
                ? "Great — there are no open problems for these filters. Try “All” to see ignored or fixed items."
                : "Try a different status, severity or area."
          }
          action={
            rows.length > 0 && (severity !== "all" || category !== "all" || status !== "all") ? (
              <Button variant="secondary" size="sm" onClick={() => { setSeverity("all"); setCategory("all"); setStatus("all"); }}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.code}>
              <RuleGroup group={g} open={expanded.has(g.code)} onToggle={() => toggle(g.code)} projectId={projectId} canEdit={canEdit} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RuleGroup({
  group: g,
  open,
  onToggle,
  projectId,
  canEdit,
}: {
  group: Group;
  open: boolean;
  onToggle: () => void;
  projectId: string;
  canEdit: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const panelId = `rule-${g.code}`;
  const sitewide = g.rows.length === 1 && !g.rows[0].pageUrl;
  const visible = showAll ? g.rows : g.rows.slice(0, PAGE_LIMIT);

  return (
    <Card as="article" className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="focus-ring flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2/60 sm:px-6"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={g.severity} />
            <Badge>{categoryLabel(g.category)}</Badge>
            <span className="text-caption text-muted tabular-nums">
              {sitewide ? "Whole site" : `${g.rows.length} ${g.rows.length === 1 ? "page" : "pages"}`}
            </span>
          </div>
          <h3 className="mt-2 text-h4 text-fg">{g.title}</h3>
          <p className="mt-1 text-small text-muted">{g.why}</p>
        </div>
        <ChevronDown
          aria-hidden
          className={clsx("mt-1 size-5 shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div id={panelId} className="animate-fade-in space-y-4 border-t border-border px-5 py-4 sm:px-6">
          <div className="flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-small text-fg-soft">
            <Wrench aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
            <p>
              <span className="font-semibold text-fg">How to fix: </span>
              {g.fix}
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-caption uppercase tracking-[0.06em] text-muted">
              {sitewide ? "Details" : "Affected pages"}
            </h4>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {visible.map((r) => (
                <FindingItem key={r.id} row={r} projectId={projectId} canEdit={canEdit} />
              ))}
            </ul>
            {g.rows.length > PAGE_LIMIT && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show fewer" : `Show all ${g.rows.length} pages`}
              </Button>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-caption text-muted">
            <Lightbulb aria-hidden className="size-3.5" />
            Rule <code className="font-mono">{g.code}</code> · fixed items are marked automatically after your next crawl.
          </p>
        </div>
      )}
    </Card>
  );
}

function FindingItem({ row: r, projectId, canEdit }: { row: FindingRow; projectId: string; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const detailsId = `ev-${r.id}`;
  const ignored = r.status === "ignored";

  async function toggleIgnore() {
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/findings/${r.id}`, { method: "PATCH", body: { status: ignored ? "open" : "ignored" } });
      toast(ignored ? "Restored — this will count as an open problem again." : "Ignored — it won't count towards your open problems.", "success");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={clsx("bg-surface px-3 py-3 sm:px-4", ignored && "bg-surface-2/60")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={clsx("break-all text-small font-medium", ignored ? "text-muted line-through decoration-muted/60" : "text-fg")}>
            {r.pageUrl ?? "Site-wide check"}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
            <span>{r.message}</span>
            {r.confidence < 1 && <span className="tabular-nums">· {Math.round(r.confidence * 100)}% sure</span>}
            {r.status !== "open" && <StatusBadge status={r.status === "resolved" ? "resolved" : r.status} />}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            aria-expanded={details}
            aria-controls={detailsId}
            onClick={() => setDetails((v) => !v)}
            iconRight={<ChevronDown className={clsx("transition-transform", details && "rotate-180")} />}
          >
            Evidence
          </Button>
          {canEdit && r.status !== "resolved" && (
            <Button
              variant="ghost"
              size="xs"
              loading={busy}
              icon={ignored ? <RotateCcw /> : <EyeOff />}
              onClick={toggleIgnore}
              aria-label={`${ignored ? "Restore" : "Ignore"} this finding for ${r.pageUrl ?? "the site"}`}
            >
              {ignored ? "Restore" : "Ignore"}
            </Button>
          )}
        </div>
      </div>
      {details && (
        <div id={detailsId} className="animate-fade-in mt-3 rounded-lg bg-surface-2 p-3">
          <EvidenceList evidence={r.evidence} skipUrl={r.pageUrl} />
          <p className="mt-2 text-caption text-muted">First detected {fmtDate(r.detectedAt, true)}</p>
        </div>
      )}
    </li>
  );
}
