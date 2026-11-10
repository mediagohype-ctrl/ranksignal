"use client";
// Report builder: pick and order sections, write an intro and agency notes, choose dates, save as a template for
// this website (or as the organization default), then open the printable / PDF version or a share link.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, ExternalLink, FileDown, Save, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardBody, CardFooter, CardHeader, Field, Input, LinkButton, Notice, Select, Textarea, useToast } from "@/components/ui";
import { SwitchRow } from "@/components/app/project-settings/switch";
import {
  INTRO_MAX, NOTES_MAX, RANGE_LABEL, RANGE_PRESETS, SECTION_META, type RangePreset, type ReportBuilderLimits, type SectionChoice, type TemplateView,
} from "@/lib/report-builder/sections";

type Draft = Pick<TemplateView, "name" | "sections" | "intro" | "notes" | "range" | "shareEnabled">;

const NEW = "__new__";
const ORG = "org-default";

const toDraft = (t: Draft): Draft => ({
  name: t.name,
  sections: t.sections.map((s) => ({ ...s })),
  intro: t.intro,
  notes: t.notes,
  range: { ...t.range },
  shareEnabled: t.shareEnabled,
});

export function ReportBuilder({
  projectId,
  templates: initialTemplates,
  orgDefault: initialOrgDefault,
  starter,
  limits,
  canEdit,
  isAdmin,
  shareBase,
  whiteLabel,
}: {
  projectId: string;
  templates: TemplateView[];
  orgDefault: TemplateView | null;
  /** Starting point for a new template (org default or the built-in layout). */
  starter: Draft;
  limits: ReportBuilderLimits;
  canEdit: boolean;
  isAdmin: boolean;
  /** Project share link base (…/r/<token>) when sharing is on and the viewer is an admin; null otherwise. */
  shareBase: string | null;
  /** Organization's white-label branding will be used on the report. */
  whiteLabel: boolean;
}) {
  const toast = useToast();
  const [templates, setTemplates] = useState(initialTemplates);
  const [orgDefault, setOrgDefault] = useState(initialOrgDefault);
  const [selected, setSelected] = useState<string>(initialTemplates[0]?.id ?? NEW);
  const current = selected === ORG ? orgDefault : templates.find((t) => t.id === selected) ?? null;
  const [draft, setDraft] = useState<Draft>(toDraft(current ?? starter));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const readOnly = !canEdit || (selected === ORG && !isAdmin);

  const pick = (id: string) => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setSelected(id);
    const t = id === ORG ? orgDefault : templates.find((x) => x.id === id);
    setDraft(toDraft(t ?? starter));
    setDirty(false);
  };
  const edit = (fn: (d: Draft) => Draft) => {
    setDraft((d) => fn(d));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) =>
    edit((d) => {
      const s = [...d.sections];
      const j = i + dir;
      if (j < 0 || j >= s.length) return d;
      [s[i], s[j]] = [s[j]!, s[i]!];
      return { ...d, sections: s };
    });
  const toggle = (i: number, enabled: boolean) => edit((d) => ({ ...d, sections: d.sections.map((s, k) => (k === i ? { ...s, enabled } : s)) }));

  async function call(method: string, url: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as { item?: TemplateView; error?: { message?: string } } | null;
    if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong. Please try again.");
    return data;
  }
  const body = () => ({
    name: draft.name,
    sections: draft.sections,
    intro: draft.intro,
    notes: draft.notes,
    range: draft.range.preset === "custom" ? draft.range : { preset: draft.range.preset },
    ...(isAdmin && selected !== ORG ? { shareEnabled: draft.shareEnabled } : {}),
  });

  async function save() {
    setBusy("save");
    try {
      if (selected === NEW) {
        const data = await call("POST", `/api/projects/${projectId}/report-templates`, { ...body(), scope: "project" });
        setTemplates((t) => [...t, data!.item!]);
        setSelected(data!.item!.id);
        setDraft(toDraft(data!.item!));
      } else {
        const data = await call("PATCH", `/api/projects/${projectId}/report-templates/${current?.id ?? selected}`, body());
        if (selected === ORG) setOrgDefault(data!.item!);
        else setTemplates((t) => t.map((x) => (x.id === data!.item!.id ? data!.item! : x)));
        setDraft(toDraft(data!.item!));
      }
      setDirty(false);
      toast("Template saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveAsOrgDefault() {
    setBusy("org");
    try {
      const { shareEnabled: _s, ...rest } = body() as ReturnType<typeof body> & { shareEnabled?: boolean };
      void _s;
      const data = await call("POST", `/api/projects/${projectId}/report-templates`, { ...rest, scope: "org_default" });
      setOrgDefault(data!.item!);
      toast("Saved as the default for every website in your organization", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!current || !window.confirm(`Delete “${current.name}”? This can't be undone.`)) return;
    setBusy("delete");
    try {
      await call("DELETE", `/api/projects/${projectId}/report-templates/${current.id}`);
      if (selected === ORG) setOrgDefault(null);
      else setTemplates((t) => t.filter((x) => x.id !== current.id));
      setSelected(NEW);
      setDraft(toDraft(starter));
      setDirty(false);
      toast("Template deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete", "error");
    } finally {
      setBusy(null);
    }
  }

  const savedId = selected === NEW ? null : selected === ORG ? ORG : selected;
  const printHref = savedId ? `/app/projects/${projectId}/monthly/builder/print?template=${encodeURIComponent(savedId)}` : null;
  const shareLink = useMemo(
    () => (shareBase && current && selected !== ORG && current.shareEnabled ? `${shareBase}/custom/${current.id}` : null),
    [shareBase, current, selected],
  );
  const atLimit = templates.length >= limits.maxTemplatesPerProject;
  const enabledCount = draft.sections.filter((s) => s.enabled).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Template" description="Saved layouts for this website. Start from one, or make a new one." />
          <CardBody className="space-y-4">
            <Field label="Choose a template" htmlFor="tpl">
              <Select id="tpl" value={selected} onChange={(e) => pick(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                {orgDefault && <option value={ORG}>Organization default: {orgDefault.name}</option>}
                <option value={NEW} disabled={atLimit && selected !== NEW}>
                  {atLimit ? `New template (limit of ${limits.maxTemplatesPerProject} reached)` : "+ New template"}
                </option>
              </Select>
            </Field>
            <Field label="Template name" htmlFor="tpl-name">
              <Input id="tpl-name" value={draft.name} maxLength={80} disabled={readOnly} onChange={(e) => edit((d) => ({ ...d, name: e.target.value }))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Dates" htmlFor="tpl-range" className="sm:col-span-1">
                <Select
                  id="tpl-range"
                  value={draft.range.preset}
                  disabled={readOnly}
                  onChange={(e) => edit((d) => ({ ...d, range: { ...d.range, preset: e.target.value as RangePreset } }))}
                >
                  {RANGE_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {RANGE_LABEL[p]}
                    </option>
                  ))}
                </Select>
              </Field>
              {draft.range.preset === "custom" && (
                <>
                  <Field label="From" htmlFor="tpl-from">
                    <Input id="tpl-from" type="date" value={draft.range.from ?? ""} disabled={readOnly} onChange={(e) => edit((d) => ({ ...d, range: { ...d.range, from: e.target.value } }))} />
                  </Field>
                  <Field label="To" htmlFor="tpl-to">
                    <Input id="tpl-to" type="date" value={draft.range.to ?? ""} disabled={readOnly} onChange={(e) => edit((d) => ({ ...d, range: { ...d.range, to: e.target.value } }))} />
                  </Field>
                </>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sections" description={`Switch sections on or off and move them up or down. ${enabledCount} of ${draft.sections.length} on.`} />
          <CardBody className="py-2">
            <ol className="divide-y divide-border">
              {draft.sections.map((s: SectionChoice, i) => {
                const meta = SECTION_META[s.id];
                return (
                  <li key={s.id} className="flex items-start gap-2">
                    <div className="flex shrink-0 flex-col pt-3">
                      <Button variant="ghost" size="icon-sm" aria-label={`Move ${meta.label} up`} disabled={readOnly || i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${meta.label} down`}
                        disabled={readOnly || i === draft.sections.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <SwitchRow
                        id={`sec-${s.id}`}
                        label={`${i + 1}. ${meta.label}`}
                        help={
                          <>
                            {meta.help}
                            {meta.optionalData && " Left out automatically when there's no data."}
                          </>
                        }
                        checked={s.enabled}
                        disabled={readOnly}
                        onChange={(v) => toggle(i, v)}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Your words" description="Shown exactly as you write them. Keep claims honest — no ranking guarantees." />
          <CardBody className="space-y-4">
            <Field label="Intro note (top of the report)" htmlFor="tpl-intro" optional hint={`${draft.intro.length} / ${INTRO_MAX}`}>
              <Textarea id="tpl-intro" rows={4} maxLength={INTRO_MAX} value={draft.intro} disabled={readOnly} onChange={(e) => edit((d) => ({ ...d, intro: e.target.value }))} />
            </Field>
            <Field label="Notes from the agency (its own section)" htmlFor="tpl-notes" optional hint={`${draft.notes.length} / ${NOTES_MAX}`}>
              <Textarea id="tpl-notes" rows={6} maxLength={NOTES_MAX} value={draft.notes} disabled={readOnly} onChange={(e) => edit((d) => ({ ...d, notes: e.target.value }))} />
            </Field>
          </CardBody>
          {canEdit && (
            <CardFooter>
              {dirty && <span className="mr-auto text-small text-muted">Unsaved changes</span>}
              {current && !readOnly && (
                <Button variant="ghost" icon={<Trash2 />} loading={busy === "delete"} onClick={remove}>
                  Delete
                </Button>
              )}
              {isAdmin && limits.orgDefault && selected !== ORG && (
                <Button variant="secondary" loading={busy === "org"} disabled={!draft.name.trim()} onClick={saveAsOrgDefault}>
                  Save as organization default
                </Button>
              )}
              {!readOnly && (
                <Button icon={<Save />} loading={busy === "save"} disabled={(!dirty && selected !== NEW) || !draft.name.trim() || (selected === NEW && atLimit)} onClick={save}>
                  {selected === NEW ? "Save template" : "Save changes"}
                </Button>
              )}
            </CardFooter>
          )}
        </Card>
      </div>

      <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader icon={<FileDown />} title="Get the report" />
          <CardBody className="space-y-3 text-small">
            {printHref && !dirty ? (
              <LinkButton href={printHref} icon={<FileDown />} fullWidth>
                Open printable report (PDF)
              </LinkButton>
            ) : (
              <p className="text-muted">Save the template first, then open the printable version to save it as a PDF.</p>
            )}
            <p className="text-muted">
              {whiteLabel ? "Your agency's logo, name and colours are used on the report." : "The report uses our standard branding. White-label branding comes with the Agency plan (Settings → Branding)."}
            </p>
          </CardBody>
        </Card>

        {selected !== ORG && (
          <Card>
            <CardHeader icon={<ExternalLink />} title="Share link" />
            <CardBody className="space-y-3 text-small">
              {!isAdmin ? (
                <p className="text-muted">Only owners and admins can share reports.</p>
              ) : !shareBase ? (
                <Notice tone="info" title="Turn on report sharing first">
                  Share links use this website&apos;s report sharing. Turn it on from the Report page, then come back here.
                </Notice>
              ) : (
                <>
                  <SwitchRow
                    id="tpl-share"
                    label="Anyone with the link can view this report"
                    help="Read-only. Turning off report sharing for the website (or rotating its link) also stops this link."
                    checked={draft.shareEnabled}
                    disabled={!canEdit || selected === NEW}
                    onChange={(v) => edit((d) => ({ ...d, shareEnabled: v }))}
                  />
                  {selected === NEW && <p className="text-muted">Save the template to get a link.</p>}
                  {shareLink && !dirty && (
                    <div className="flex items-center gap-2">
                      <Input readOnly value={shareLink} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
                      <Button
                        variant="secondary"
                        size="icon"
                        aria-label="Copy link"
                        onClick={() => navigator.clipboard.writeText(shareLink).then(() => toast("Link copied", "success"), () => toast("Couldn't copy", "error"))}
                      >
                        <Copy />
                      </Button>
                    </div>
                  )}
                  {current?.shareEnabled && <Badge tone="success" size="sm">Shared</Badge>}
                </>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
