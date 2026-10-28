"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Bell, CalendarClock, Globe2, Plus, Settings2, Sparkles, Tag, Trash2, Users, Wand2 } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { CLASS_B_TYPES } from "@/lib/policy/engine";
import { frequencyDays, type ProjectSchedule, type ScheduleFrequency } from "@/lib/dashboard/project-schema";
import {
  Badge, Button, Card, CardBody, CardFooter, CardHeader, Field, Input, Notice, Select, fieldDescribedBy, useToast,
} from "@/components/ui";
import { DangerZone } from "./danger-zone";

export interface CompetitorRow {
  name: string;
  domain: string;
  /** Comma-separated in the form; split on save. */
  aliases: string;
}

export interface ProjectSettingsInitial {
  name: string;
  websiteUrl: string;
  brandNames: string[];
  competitors: CompetitorRow[];
  countries: string[];
  languages: string[];
  schedule: ProjectSchedule;
  allowClassB: string[];
  emailNotifications: boolean;
}

interface Props {
  projectId: string;
  initial: ProjectSettingsInitial;
  lastRuns: { crawl: string | null; visibility: string | null };
  plan: { name: string; minScanIntervalDays: number };
  canEdit: boolean;
  isAdmin: boolean;
}

const AUTOMATION_HELP: Record<string, { label: string; what: string; risk: string }> = {
  update_meta_description: {
    label: "Page summaries (meta descriptions)",
    what: "The short text search engines and AI tools may show under your page title.",
    risk: "Low risk: visitors don't see it on the page itself, and the old version is saved so it can be undone.",
  },
  update_title: {
    label: "Page titles",
    what: "The clickable headline shown in search results and browser tabs.",
    risk: "Low to medium risk: titles are visible in search results. Your homepage and key pages always need approval.",
  },
  update_image_alt: {
    label: "Image descriptions (alt text)",
    what: "Short descriptions of images, read aloud by screen readers and used by search engines.",
    risk: "Low risk: not visible to most visitors, and helps accessibility. Can be undone.",
  },
  update_og_tags: {
    label: "Link previews (social sharing tags)",
    what: "The title, text and image shown when someone shares your page in chat or social apps.",
    risk: "Low risk: only affects previews of shared links. Can be undone.",
  },
};

const FREQ_LABEL: Record<ScheduleFrequency, string> = { off: "Off", weekly: "Every week", monthly: "Every month" };
const DAY_MS = 86_400_000;

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function nextRunText(freq: ScheduleFrequency, minDays: number, last: string | null): string {
  const days = frequencyDays(freq);
  if (days === null) return "Automatic runs are off.";
  if (!last) return "The first automatic run starts within a few minutes.";
  const next = new Date(new Date(last).getTime() + Math.max(days, minDays) * DAY_MS);
  if (next.getTime() <= Date.now()) return "Due now — it will start within a few minutes.";
  return `Next automatic run around ${next.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}.`;
}

function SaveFooter({ dirty, saving, disabled, onSave, onReset }: { dirty: boolean; saving: boolean; disabled: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <CardFooter>
      <div className="flex w-full items-center justify-end gap-2">
        {dirty && !saving && <span className="mr-auto text-small text-muted">Unsaved changes</span>}
        <Button variant="secondary" size="sm" onClick={onReset} disabled={!dirty || saving || disabled}>
          Reset
        </Button>
        <Button size="sm" onClick={onSave} loading={saving} loadingText="Saving…" disabled={!dirty || disabled}>
          Save
        </Button>
      </div>
    </CardFooter>
  );
}

export function ProjectSettingsForm({ projectId, initial, lastRuns, plan, canEdit, isAdmin }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const [name, setName] = useState(initial.name);
  const [brands, setBrands] = useState<string[]>(initial.brandNames.length ? initial.brandNames : [""]);
  const [competitors, setCompetitors] = useState<CompetitorRow[]>(initial.competitors);
  const [countries, setCountries] = useState(initial.countries.join(", "));
  const [languages, setLanguages] = useState(initial.languages.join(", "));
  const [schedule, setSchedule] = useState<ProjectSchedule>(initial.schedule);
  const [allowB, setAllowB] = useState<string[]>(initial.allowClassB);
  const [emailOn, setEmailOn] = useState(initial.emailNotifications);

  async function save(section: string, body: Record<string, unknown>, apply: (s: ProjectSettingsInitial) => ProjectSettingsInitial) {
    setSaving(section);
    setErrors((e) => ({ ...e, [section]: undefined }));
    try {
      await api(`/api/projects/${projectId}`, { method: "PATCH", body });
      setSaved(apply);
      toast("Settings saved.", "success");
      router.refresh();
    } catch (err) {
      const msg = errorMessage(err);
      setErrors((e) => ({ ...e, [section]: msg }));
      toast(msg, "error");
    } finally {
      setSaving(null);
    }
  }

  // ---- General ----
  const generalDirty = name.trim() !== saved.name;
  const saveGeneral = () => {
    if (!name.trim()) return setErrors((e) => ({ ...e, general: "Please enter a project name." }));
    void save("general", { name: name.trim() }, (s) => ({ ...s, name: name.trim() }));
  };

  // ---- Brand names ----
  const cleanBrands = brands.map((b) => b.trim()).filter(Boolean);
  const brandsDirty = JSON.stringify(cleanBrands) !== JSON.stringify(saved.brandNames);
  const saveBrands = () => {
    if (cleanBrands.length === 0) return setErrors((e) => ({ ...e, brands: "Add at least one name your customers use for you." }));
    if (new Set(cleanBrands.map((b) => b.toLowerCase())).size !== cleanBrands.length)
      return setErrors((e) => ({ ...e, brands: "Each name should appear only once." }));
    void save("brands", { brandNames: cleanBrands }, (s) => ({ ...s, brandNames: cleanBrands }));
  };

  // ---- Competitors ----
  const cleanCompetitors = competitors
    .map((c) => ({ name: c.name.trim(), domain: c.domain.trim(), aliases: c.aliases }))
    .filter((c) => c.name || c.domain);
  const competitorsDirty = JSON.stringify(cleanCompetitors) !== JSON.stringify(saved.competitors);
  const saveCompetitors = () => {
    if (cleanCompetitors.some((c) => !c.name)) return setErrors((e) => ({ ...e, competitors: "Every competitor needs a name." }));
    const payload = cleanCompetitors.map((c) => ({ name: c.name, domain: c.domain || undefined, aliases: splitList(c.aliases) }));
    void save("competitors", { competitors: payload }, (s) => ({ ...s, competitors: cleanCompetitors }));
  };

  // ---- Markets ----
  const countryList = splitList(countries).map((c) => c.toUpperCase());
  const languageList = splitList(languages).map((l) => l.toLowerCase());
  const marketsDirty =
    JSON.stringify(countryList) !== JSON.stringify(saved.countries) || JSON.stringify(languageList) !== JSON.stringify(saved.languages);
  const saveMarkets = () => {
    if (countryList.some((c) => !/^[A-Z]{2}$/.test(c)))
      return setErrors((e) => ({ ...e, markets: "Use 2-letter country codes separated by commas, e.g. IN, US, GB." }));
    if (languageList.length === 0 || languageList.some((l) => !/^[a-z]{2,3}(-[a-z]{2})?$/.test(l)))
      return setErrors((e) => ({ ...e, markets: "Add at least one language code, e.g. en or hi." }));
    void save("markets", { countries: countryList, languages: languageList }, (s) => ({ ...s, countries: countryList, languages: languageList }));
  };

  // ---- Schedule / automation / notifications ----
  const scheduleDirty = JSON.stringify(schedule) !== JSON.stringify(saved.schedule);
  const automationDirty = JSON.stringify([...allowB].sort()) !== JSON.stringify([...saved.allowClassB].sort());
  const notificationsDirty = emailOn !== saved.emailNotifications;
  const freqAllowed = (f: ScheduleFrequency) => {
    const d = frequencyDays(f);
    return d === null || d >= plan.minScanIntervalDays;
  };

  const adminOnlyNote = !isAdmin && (
    <Notice tone="neutral" className="mb-4">Only owners and admins can change this.</Notice>
  );

  return (
    <div className="space-y-8">
      {!canEdit && (
        <Notice tone="info" title="View only">
          You have view access to this project. Ask an owner or admin if you need to change anything.
        </Notice>
      )}

      <Card as="section">
        <CardHeader title="General" description="Basic details for this project." icon={<Settings2 />} />
        <CardBody className="space-y-5">
          <Field label="Project name" htmlFor="ps-name" error={errors.general} required>
            <Input
              id="ps-name"
              value={name}
              maxLength={120}
              disabled={!canEdit}
              invalid={!!errors.general}
              aria-describedby={fieldDescribedBy("ps-name", { error: errors.general })}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            label="Website"
            htmlFor="ps-url"
            hint="The website can't be changed, so your history stays comparable. To track a different site, create a new project."
          >
            <Input id="ps-url" value={initial.websiteUrl} readOnly aria-describedby={fieldDescribedBy("ps-url", { hint: true })} />
          </Field>
        </CardBody>
        <SaveFooter dirty={generalDirty} saving={saving === "general"} disabled={!canEdit} onSave={saveGeneral} onReset={() => setName(saved.name)} />
      </Card>

      <Card as="section">
        <CardHeader
          title="Brand names & aliases"
          description="Every name people use for your business — we look for these in AI answers. Include short forms and common misspellings."
          icon={<Tag />}
        />
        <CardBody className="space-y-3">
          <ul className="space-y-2">
            {brands.map((b, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input
                  aria-label={`Brand name ${i + 1}`}
                  value={b}
                  maxLength={120}
                  disabled={!canEdit}
                  placeholder={i === 0 ? "e.g. Acme Bakery" : "e.g. Acme"}
                  onChange={(e) => setBrands((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove brand name ${b || i + 1}`}
                  disabled={!canEdit || brands.length <= 1}
                  onClick={() => setBrands((xs) => xs.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" size="sm" icon={<Plus />} disabled={!canEdit || brands.length >= 20} onClick={() => setBrands((xs) => [...xs, ""])}>
            Add a name
          </Button>
          {errors.brands && <p className="text-small text-danger" role="alert">{errors.brands}</p>}
        </CardBody>
        <SaveFooter
          dirty={brandsDirty}
          saving={saving === "brands"}
          disabled={!canEdit}
          onSave={saveBrands}
          onReset={() => setBrands(saved.brandNames.length ? saved.brandNames : [""])}
        />
      </Card>

      <Card as="section">
        <CardHeader
          title="Competitors"
          description="Businesses you want to compare against in AI answers. Up to 20."
          icon={<Users />}
        />
        <CardBody className="space-y-3">
          {competitors.length === 0 && <p className="text-small text-muted">No competitors yet. Add the two or three you lose customers to most often.</p>}
          <ul className="space-y-3">
            {competitors.map((c, i) => {
              const upd = (patch: Partial<CompetitorRow>) => setCompetitors((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <li key={i} className="grid gap-2 rounded-xl bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
                  <Field label="Name" htmlFor={`ps-comp-${i}-name`}>
                    <Input id={`ps-comp-${i}-name`} value={c.name} maxLength={120} disabled={!canEdit} onChange={(e) => upd({ name: e.target.value })} />
                  </Field>
                  <Field label="Website" htmlFor={`ps-comp-${i}-domain`} optional>
                    <Input id={`ps-comp-${i}-domain`} value={c.domain} placeholder="example.com" disabled={!canEdit} onChange={(e) => upd({ domain: e.target.value })} />
                  </Field>
                  <Field label="Other names" htmlFor={`ps-comp-${i}-aliases`} optional>
                    <Input id={`ps-comp-${i}-aliases`} value={c.aliases} placeholder="Comma separated" disabled={!canEdit} onChange={(e) => upd({ aliases: e.target.value })} />
                  </Field>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove competitor ${c.name || i + 1}`}
                    disabled={!canEdit}
                    onClick={() => setCompetitors((xs) => xs.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus />}
            disabled={!canEdit || competitors.length >= 20}
            onClick={() => setCompetitors((xs) => [...xs, { name: "", domain: "", aliases: "" }])}
          >
            Add competitor
          </Button>
          {errors.competitors && <p className="text-small text-danger" role="alert">{errors.competitors}</p>}
        </CardBody>
        <SaveFooter
          dirty={competitorsDirty}
          saving={saving === "competitors"}
          disabled={!canEdit}
          onSave={saveCompetitors}
          onReset={() => setCompetitors(saved.competitors)}
        />
      </Card>

      <Card as="section">
        <CardHeader title="Markets" description="Where your customers are and which languages they use. We ask AI assistants with these in mind." icon={<Globe2 />} />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label="Countries" htmlFor="ps-countries" hint="2-letter codes, comma separated — e.g. IN, US, GB">
            <Input id="ps-countries" value={countries} disabled={!canEdit} aria-describedby={fieldDescribedBy("ps-countries", { hint: true })} onChange={(e) => setCountries(e.target.value)} />
          </Field>
          <Field label="Languages" htmlFor="ps-languages" hint="Language codes, comma separated — e.g. en, hi">
            <Input id="ps-languages" value={languages} disabled={!canEdit} aria-describedby={fieldDescribedBy("ps-languages", { hint: true })} onChange={(e) => setLanguages(e.target.value)} />
          </Field>
          {errors.markets && <p className="text-small text-danger sm:col-span-2" role="alert">{errors.markets}</p>}
        </CardBody>
        <SaveFooter
          dirty={marketsDirty}
          saving={saving === "markets"}
          disabled={!canEdit}
          onSave={saveMarkets}
          onReset={() => {
            setCountries(saved.countries.join(", "));
            setLanguages(saved.languages.join(", "));
          }}
        />
      </Card>

      <Card as="section">
        <CardHeader
          title="Schedule"
          description="Run checks automatically so you can see how things change over time. Each run uses credits from your plan."
          icon={<CalendarClock />}
        />
        <CardBody>
          {adminOnlyNote}
          <div className="grid gap-5 sm:grid-cols-2">
            {(
              [
                ["crawl", "Website scan", "Reads your pages and checks for problems."],
                ["visibility", "AI visibility check", "Asks AI assistants your tracked questions."],
              ] as const
            ).map(([kind, label, help]) => (
              <Field key={kind} label={label} htmlFor={`ps-sched-${kind}`} hint={`${help} ${nextRunText(saved.schedule[kind], plan.minScanIntervalDays, lastRuns[kind])}`}>
                <Select
                  id={`ps-sched-${kind}`}
                  value={schedule[kind]}
                  disabled={!isAdmin}
                  aria-describedby={fieldDescribedBy(`ps-sched-${kind}`, { hint: true })}
                  onChange={(e) => setSchedule((s) => ({ ...s, [kind]: e.target.value as ScheduleFrequency }))}
                >
                  {(["off", "weekly", "monthly"] as const).map((f) => (
                    <option key={f} value={f} disabled={!freqAllowed(f)}>
                      {FREQ_LABEL[f]}
                      {!freqAllowed(f) ? " (not on your plan)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
          <p className="mt-4 text-small text-muted">
            Your {plan.name} plan runs automatic checks at most every {plan.minScanIntervalDays === 1 ? "day" : `${plan.minScanIntervalDays} days`}.
            Automatic runs pause if your plan isn&apos;t active. You can always start a check by hand from the project overview.
          </p>
          {errors.schedule && <p className="mt-2 text-small text-danger" role="alert">{errors.schedule}</p>}
        </CardBody>
        <SaveFooter
          dirty={scheduleDirty}
          saving={saving === "schedule"}
          disabled={!isAdmin}
          onSave={() => void save("schedule", { settings: { schedule } }, (s) => ({ ...s, schedule }))}
          onReset={() => setSchedule(saved.schedule)}
        />
      </Card>

      <Card as="section">
        <CardHeader
          title="Automatic fixes"
          description="Small, low-risk edits we may publish without asking first — only on pages that aren't your homepage or key pages, and only through a connected platform that lets us undo the change."
          icon={<Wand2 />}
        />
        <CardBody className="space-y-4">
          {adminOnlyNote}
          <fieldset className="grid gap-3 md:grid-cols-2">
            <legend className="sr-only">Changes allowed without approval</legend>
            {CLASS_B_TYPES.map((t) => {
              const h = AUTOMATION_HELP[t] ?? { label: t.replace(/_/g, " "), what: "", risk: "" };
              const checked = allowB.includes(t);
              return (
                <label
                  key={t}
                  className={clsx(
                    "flex items-start gap-3 rounded-xl border p-4 transition-colors",
                    isAdmin ? "cursor-pointer hover:bg-surface-2" : "cursor-not-allowed opacity-80",
                    checked ? "border-primary bg-primary-soft" : "border-border",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    checked={checked}
                    disabled={!isAdmin}
                    onChange={(e) => setAllowB((xs) => (e.target.checked ? [...xs, t] : xs.filter((x) => x !== t)))}
                  />
                  <span className="space-y-1">
                    <span className="flex flex-wrap items-center gap-2 text-small font-medium text-fg">
                      {h.label}
                      {checked && <Badge tone="primary" size="sm">Automatic</Badge>}
                    </span>
                    <span className="block text-small text-fg-soft">{h.what}</span>
                    <span className="block text-xs text-muted">{h.risk}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <Notice tone="tip" icon={<Sparkles />} title="Everything else waits for you">
            Content, structured data and anything on important pages always need your approval of the exact wording. Risky
            changes (like deleting pages or redirects) are never automated. Every automatic change is logged and can be rolled back.
          </Notice>
          {errors.automation && <p className="text-small text-danger" role="alert">{errors.automation}</p>}
        </CardBody>
        <SaveFooter
          dirty={automationDirty}
          saving={saving === "automation"}
          disabled={!isAdmin}
          onSave={() => void save("automation", { settings: { automation: { allowClassB: allowB } } }, (s) => ({ ...s, allowClassB: allowB }))}
          onReset={() => setAllowB(saved.allowClassB)}
        />
      </Card>

      <Card as="section">
        <CardHeader title="Notifications" description="In-app notifications are always on. Choose whether owners and admins also get emails." icon={<Bell />} />
        <CardBody>
          <label className={clsx("flex items-start gap-3", canEdit ? "cursor-pointer" : "cursor-not-allowed")}>
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={emailOn}
              disabled={!canEdit}
              onChange={(e) => setEmailOn(e.target.checked)}
            />
            <span>
              <span className="block text-small font-medium text-fg">Email owners and admins about this project</span>
              <span className="block text-small text-muted">
                When a report is ready, an AI visibility check finishes, a scan fails, or changes need approval.
              </span>
            </span>
          </label>
        </CardBody>
        <SaveFooter
          dirty={notificationsDirty}
          saving={saving === "notifications"}
          disabled={!canEdit}
          onSave={() => void save("notifications", { settings: { notifications: { email: emailOn } } }, (s) => ({ ...s, emailNotifications: emailOn }))}
          onReset={() => setEmailOn(saved.emailNotifications)}
        />
      </Card>

      {isAdmin && <DangerZone projectId={projectId} projectName={saved.name} />}
    </div>
  );
}
