"use client";
import { useMemo, useState } from "react";
import {
  BadgeCheck, CalendarCheck, ExternalLink, Globe2, Hourglass, Lightbulb, ListPlus, MapPinOff, Pencil, Plus, Quote, Search, Sparkles, Trash2,
} from "lucide-react";
import {
  Badge, Button, Card, CardBody, CardHeader, Dialog, EmptyState, Input, Notice, Select, SectionHeading, Stat, Table, TD, TH, THead, TR, Tabs,
  useToast, type Tone,
} from "@/components/ui";
import {
  NEXT_STATUSES,
  OFFSITE_TYPES,
  STARTER_CATEGORY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  type OffsiteItemView,
  type OffsiteStatus,
  type OffsiteType,
} from "@/lib/offsite/types";
import type { AiCitationSuggestion, StarterSuggestion } from "@/lib/offsite/suggestions";
import { OffsiteFormDialog, type OffsiteDraft } from "./offsite-form-dialog";
import { offsiteApi } from "./offsite-api";

const STATUS_TONE: Record<OffsiteStatus, Tone> = { todo: "neutral", submitted: "info", live: "success", rejected: "danger" };

function monthStartUtc(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const hostOf = (u: string | null) => {
  if (!u) return null;
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

export interface OffsiteSuggestionsView {
  aiCitations: AiCitationSuggestion[];
  measuredAt: string | null;
  starter: StarterSuggestion[];
}

export function OffsiteClient({
  projectId,
  initialItems,
  suggestions,
  canEdit,
}: {
  projectId: string;
  initialItems: OffsiteItemView[];
  suggestions: OffsiteSuggestionsView | null;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState<"all" | OffsiteStatus>("all");
  const [type, setType] = useState<"all" | OffsiteType>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<OffsiteItemView | null>(null);
  const [draft, setDraft] = useState<OffsiteDraft | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<OffsiteItemView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Suggestions disappear once added (server recomputes on next load).
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const monthStart = monthStartUtc();
    const c = { all: items.length, todo: 0, submitted: 0, live: 0, rejected: 0, liveThisMonth: 0, napIssues: 0 };
    for (const i of items) {
      c[i.status]++;
      if (i.status === "live" && i.liveAt && new Date(i.liveAt) >= monthStart) c.liveThisMonth++;
      if (i.napConsistent === false) c.napIssues++;
    }
    return c;
  }, [items]);

  const shown = items.filter((i) => {
    if (status !== "all" && i.status !== status) return false;
    if (type !== "all" && i.type !== type) return false;
    const s = q.trim().toLowerCase();
    return !s || i.name.toLowerCase().includes(s) || (i.url ?? "").toLowerCase().includes(s);
  });

  function openNew(d: OffsiteDraft | null = null) {
    setEditing(null);
    setDraft(d);
    setFormOpen(true);
  }

  function onSaved(item: OffsiteItemView, created: boolean) {
    setItems((prev) => (created ? [item, ...prev] : prev.map((p) => (p.id === item.id ? item : p))));
    setFormOpen(false);
    toast(created ? "Added to the tracker" : "Saved", "success");
  }

  async function quickAdd(key: string, body: { type: OffsiteType; name: string; url: string; source: "manual" | "ai_citation"; notes?: string }) {
    setBusyId(key);
    try {
      const res = await offsiteApi<{ item: OffsiteItemView }>(`/api/projects/${projectId}/offsite`, { method: "POST", body: JSON.stringify(body) });
      setItems((prev) => [res.item, ...prev]);
      setAddedKeys((prev) => new Set(prev).add(key));
      toast(`${body.name} added to the tracker`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't add it", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function moveStatus(item: OffsiteItemView, next: OffsiteStatus) {
    setBusyId(item.id);
    try {
      const res = await offsiteApi<{ item: OffsiteItemView }>(`/api/projects/${projectId}/offsite/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      setItems((prev) => prev.map((p) => (p.id === item.id ? res.item : p)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't update", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: OffsiteItemView) {
    setBusyId(item.id);
    try {
      await offsiteApi(`/api/projects/${projectId}/offsite/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      setConfirmDelete(null);
      toast("Removed", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't remove it", "error");
    } finally {
      setBusyId(null);
    }
  }

  const aiSuggestions = (suggestions?.aiCitations ?? []).filter((s) => !addedKeys.has(`ai:${s.domain}`));
  const starter = suggestions?.starter ?? [];

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live this month" value={<span className="tabular-nums">{counts.liveThisMonth}</span>} icon={<CalendarCheck />} hint="Listings, reviews and mentions that went live" />
        <Stat label="Live in total" value={<span className="tabular-nums">{counts.live}</span>} icon={<BadgeCheck />} hint={`of ${counts.all} tracked`} />
        <Stat label="Waiting on the site" value={<span className="tabular-nums">{counts.submitted}</span>} icon={<Hourglass />} hint="Submitted, not live yet" />
        <Stat label="Details don't match" value={<span className="tabular-nums">{counts.napIssues}</span>} icon={<MapPinOff />} hint="Name, address or phone differs from your site" />
      </div>

      <section aria-labelledby="offsite-list-h" className="space-y-4">
        <SectionHeading
          id="offsite-list-h"
          title="Tracker"
          description="Everything we're doing off your website: directory listings, review profiles, press, forums and company profiles."
          actions={canEdit ? <Button icon={<Plus />} onClick={() => openNew()}>Add item</Button> : undefined}
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            label="Filter by status"
            variant="pills"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            tabs={[
              { id: "all", label: "All", count: counts.all },
              { id: "todo", label: STATUS_LABEL.todo, count: counts.todo },
              { id: "submitted", label: STATUS_LABEL.submitted, count: counts.submitted },
              { id: "live", label: STATUS_LABEL.live, count: counts.live },
              { id: "rejected", label: STATUS_LABEL.rejected, count: counts.rejected },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select aria-label="Filter by type" inputSize="sm" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="all">All types</option>
              {OFFSITE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
            <Input aria-label="Search the tracker" inputSize="sm" placeholder="Search name or link" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <Card>
          {items.length === 0 ? (
            <EmptyState
              icon={<Globe2 />}
              title="Nothing tracked yet"
              description="Add the listings, review sites and articles you're working on — or start from the suggestions below."
              action={canEdit ? <Button icon={<Plus />} onClick={() => openNew()}>Add item</Button> : undefined}
            />
          ) : shown.length === 0 ? (
            <EmptyState size="sm" icon={<Search />} title="No items match these filters" />
          ) : (
            <Table caption="Off-site items" zebra>
              <THead>
                <tr>
                  <TH>Where</TH>
                  <TH>Type</TH>
                  <TH>Status</TH>
                  <TH>Details match</TH>
                  <TH>Went live</TH>
                  {canEdit && <TH align="right">Actions</TH>}
                </tr>
              </THead>
              <tbody>
                {shown.map((i) => (
                  <TR key={i.id}>
                    <TD>
                      <div className="font-medium text-fg">{i.name}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {i.url && hostOf(i.url) && (
                          <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="focus-ring inline-flex items-center gap-1 rounded text-primary hover:underline">
                            {hostOf(i.url)} <ExternalLink aria-hidden className="size-3" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        )}
                        {i.source === "ai_citation" && (
                          <Badge size="sm" tone="accent" icon={<Quote />}>
                            Cited by AI
                          </Badge>
                        )}
                      </div>
                    </TD>
                    <TD className="text-fg-soft">{TYPE_LABEL[i.type]}</TD>
                    <TD>
                      {canEdit ? (
                        <Select
                          aria-label={`Status of ${i.name}`}
                          inputSize="sm"
                          value={i.status}
                          disabled={busyId === i.id}
                          onChange={(e) => void moveStatus(i, e.target.value as OffsiteStatus)}
                        >
                          {[i.status, ...NEXT_STATUSES[i.status]].map((st) => (
                            <option key={st} value={st}>
                              {STATUS_LABEL[st]}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge tone={STATUS_TONE[i.status]} variant="dot">
                          {STATUS_LABEL[i.status]}
                        </Badge>
                      )}
                    </TD>
                    <TD>
                      {i.napConsistent === null ? (
                        <span className="text-small text-muted">Not checked</span>
                      ) : i.napConsistent ? (
                        <Badge size="sm" tone="success">Yes</Badge>
                      ) : (
                        <Badge size="sm" tone="warning">Needs fixing</Badge>
                      )}
                    </TD>
                    <TD className="tabular-nums text-fg-soft">{i.status === "live" ? day(i.liveAt) : "—"}</TD>
                    {canEdit && (
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${i.name}`}
                            onClick={() => {
                              setEditing(i);
                              setDraft(null);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${i.name}`} onClick={() => setConfirmDelete(i)}>
                            <Trash2 />
                          </Button>
                        </div>
                      </TD>
                    )}
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </section>

      <section aria-labelledby="offsite-suggest-h" className="space-y-4">
        <SectionHeading
          id="offsite-suggest-h"
          title="Suggestions"
          description="Places worth considering. Being listed somewhere doesn't guarantee AI assistants will mention you — but these are the sites they already look at."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              icon={<Sparkles />}
              title="Sites AI already cites"
              description={
                suggestions?.measuredAt
                  ? `Third-party sites cited in your latest AI check (${day(suggestions.measuredAt)}) that aren't in your tracker yet.`
                  : "Third-party sites cited in your AI checks that aren't in your tracker yet."
              }
            />
            <CardBody>
              {!suggestions ? (
                <Notice tone="warning" title="Couldn't load suggestions">Refresh the page to try again.</Notice>
              ) : !suggestions.measuredAt ? (
                <EmptyState size="sm" icon={<Lightbulb />} title="No AI check yet" description="Run an AI visibility check and we'll list the sites the answers cite." />
              ) : aiSuggestions.length === 0 ? (
                <EmptyState size="sm" icon={<BadgeCheck />} title="Nothing new to suggest" description="Every third-party site from your latest check is already tracked (or none were cited)." />
              ) : (
                <ul className="divide-y divide-border">
                  {aiSuggestions.map((s) => (
                    <li key={s.domain} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-small font-medium text-fg">{s.name === s.domain ? s.domain : `${s.name} · ${s.domain}`}</div>
                        <div className="text-xs text-muted">
                          {TYPE_LABEL[s.type]} · cited in <span className="tabular-nums">{s.count}</span> answer{s.count === 1 ? "" : "s"}
                        </div>
                      </div>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<ListPlus />}
                          loading={busyId === `ai:${s.domain}`}
                          onClick={() =>
                            void quickAdd(`ai:${s.domain}`, {
                              type: s.type,
                              name: s.name,
                              url: s.url,
                              source: "ai_citation",
                              notes: `Cited in ${s.count} AI answer${s.count === 1 ? "" : "s"} in the check on ${day(suggestions.measuredAt)}.`,
                            })
                          }
                        >
                          Add to tracker
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Lightbulb />} title="Starter list for India" description="Common places customers — and AI assistants — look a business up." />
            <CardBody>
              <ul className="divide-y divide-border">
                {starter.map((s) => {
                  const done = s.tracked || addedKeys.has(`starter:${s.key}`);
                  return (
                    <li key={s.key} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-small font-medium text-fg">{s.name}</div>
                        <div className="mt-0.5 text-xs text-muted">{s.note}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.categories.map((c) => (
                            <Badge key={c} size="sm" tone="neutral">
                              {STARTER_CATEGORY_LABEL[c]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {done ? (
                        <Badge tone="success" variant="dot">Tracked</Badge>
                      ) : (
                        canEdit && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<ListPlus />}
                            loading={busyId === `starter:${s.key}`}
                            onClick={() => void quickAdd(`starter:${s.key}`, { type: s.type, name: s.name, url: s.url, source: "manual" })}
                          >
                            Add
                          </Button>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        </div>
      </section>

      <OffsiteFormDialog open={formOpen} onClose={() => setFormOpen(false)} projectId={projectId} item={editing} draft={draft} onSaved={onSaved} />
      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        tone="danger"
        icon={<Trash2 />}
        title={`Remove ${confirmDelete?.name ?? "this item"}?`}
        description="It will disappear from the tracker and from future monthly reports. This doesn't change anything on the other site."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={!!confirmDelete && busyId === confirmDelete.id} onClick={() => confirmDelete && void remove(confirmDelete)}>
              Remove
            </Button>
          </>
        }
      />
    </div>
  );
}
