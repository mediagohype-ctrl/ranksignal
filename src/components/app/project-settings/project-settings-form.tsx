"use client";
// Settings (brief 5.8): My business, Connect website, Automatic checks, Auto-fix, Pause all changes, Emails, then
// Team / Plan / Expert mode (rendered by the page and passed in). Switches and selects save straight away; My
// business has the one Save button on the screen.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CalendarClock, Globe2, Mail, PauseCircle, Plug, Plus, Tag, Trash2, Wand2 } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { CLASS_B_TYPES } from "@/lib/policy/engine";
import { frequencyDays, type EmailKind, type ProjectFacts, type ProjectSchedule, type ScheduleFrequency } from "@/lib/dashboard/project-schema";
import { Button, Card, CardBody, CardFooter, CardHeader, Field, Input, LinkButton, Notice, Select, Textarea, fieldDescribedBy, useToast } from "@/components/ui";
import { DangerZone } from "./danger-zone";
import { SwitchRow } from "./switch";
import { fmtDate } from "@/lib/dashboard/format";

export interface CompetitorRow {
  name: string;
  domain: string;
  /** Comma-separated in the form; split on save. */
  aliases: string;
}

export interface ProjectSettingsInitial {
  name: string;
  websiteUrl: string;
  facts: ProjectFacts;
  brandNames: string[];
  competitors: CompetitorRow[];
  countries: string[];
  languages: string[];
  schedule: ProjectSchedule;
  autoFix: boolean;
  paused: boolean;
  emails: Record<EmailKind, boolean>;
}

interface Props {
  projectId: string;
  initial: ProjectSettingsInitial;
  lastRuns: { crawl: string | null; visibility: string | null };
  plan: { name: string; minScanIntervalDays: number };
  canEdit: boolean;
  isAdmin: boolean;
  expert?: boolean;
  integrationsHref: string;
  /** Rendered after Emails, in this order. */
  team?: React.ReactNode;
  planSection?: React.ReactNode;
  preferences?: React.ReactNode;
}

const SAFE_FIX_NAMES: Record<string, string> = {
  update_meta_description: "Google summaries",
  update_title: "Google headlines",
  update_image_alt: "Image descriptions",
  update_og_tags: "Share previews",
};

const FREQ_LABEL: Record<ScheduleFrequency, string> = { off: "Off", weekly: "Every week", monthly: "Every month" };
const EMAILS: { kind: EmailKind; label: string; help: string }[] = [
  { kind: "monthlyReport", label: "Monthly report", help: "What changed this month, in one short email." },
  { kind: "fixesWaiting", label: "Fixes waiting", help: "When fixes are ready for your OK." },
  { kind: "checkFailed", label: "Check failed", help: "When we couldn't check your website or ask AI." },
];
const DAY_MS = 86_400_000;

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function nextRunText(freq: ScheduleFrequency, minDays: number, last: string | null): string {
  const days = frequencyDays(freq);
  if (days === null) return "Off.";
  if (!last) return "The first one starts within a few minutes.";
  const next = new Date(new Date(last).getTime() + Math.max(days, minDays) * DAY_MS);
  if (next.getTime() <= Date.now()) return "Due now.";
  return `Next one around ${fmtDate(next)}.`;
}

export function ProjectSettingsForm({
  projectId,
  initial,
  lastRuns,
  plan,
  canEdit,
  isAdmin,
  expert = false,
  integrationsHref,
  team,
  planSection,
  preferences,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // My business
  const [name, setName] = useState(initial.facts.name || initial.name);
  const [city, setCity] = useState(initial.facts.city ?? "");
  const [sells, setSells] = useState(initial.facts.sells ?? "");
  const [brands, setBrands] = useState<string[]>(() => {
    const own = (initial.facts.name || initial.name).trim().toLowerCase();
    const others = initial.brandNames.filter((b) => b.trim().toLowerCase() !== own);
    return others.length ? others : [""];
  });
  const [competitors, setCompetitors] = useState<CompetitorRow[]>(initial.competitors);
  // Expert-only: markets
  const [countries, setCountries] = useState(initial.countries.join(", "));
  const [languages, setLanguages] = useState(initial.languages.join(", "));

  async function patch(section: string, body: Record<string, unknown>, apply: (s: ProjectSettingsInitial) => ProjectSettingsInitial, ok = "Saved.") {
    setBusy(section);
    setErrors((e) => ({ ...e, [section]: undefined }));
    try {
      await api(`/api/projects/${projectId}`, { method: "PATCH", body });
      setSaved(apply);
      toast(ok, "success");
      router.refresh();
      return true;
    } catch (err) {
      const msg = errorMessage(err);
      setErrors((e) => ({ ...e, [section]: msg }));
      toast(msg, "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  // ---- My business ----
  const cleanBrands = brands.map((b) => b.trim()).filter(Boolean);
  // The business name is always the first name we look for in AI answers.
  const brandNames = [name.trim(), ...cleanBrands.filter((b) => b.toLowerCase() !== name.trim().toLowerCase())].filter(Boolean).slice(0, 20);
  const cleanCompetitors = competitors
    .map((c) => ({ name: c.name.trim(), domain: c.domain.trim(), aliases: c.aliases }))
    .filter((c) => c.name || c.domain);
  const facts: ProjectFacts = { ...saved.facts, name: name.trim(), city: city.trim(), sells: sells.trim() };
  const businessDirty =
    name.trim() !== (saved.facts.name || saved.name) ||
    city.trim() !== (saved.facts.city ?? "") ||
    sells.trim() !== (saved.facts.sells ?? "") ||
    JSON.stringify(brandNames) !== JSON.stringify(saved.brandNames) ||
    JSON.stringify(cleanCompetitors) !== JSON.stringify(saved.competitors);

  function saveBusiness() {
    if (!name.trim()) return setErrors((e) => ({ ...e, business: "Please enter your business name." }));
    if (new Set(cleanBrands.map((b) => b.toLowerCase())).size !== cleanBrands.length)
      return setErrors((e) => ({ ...e, business: "Each other name should appear only once." }));
    if (cleanCompetitors.some((c) => !c.name)) return setErrors((e) => ({ ...e, business: "Every competitor needs a name." }));
    void patch(
      "business",
      {
        name: name.trim(),
        facts,
        brandNames,
        competitors: cleanCompetitors.map((c) => ({ name: c.name, domain: c.domain || undefined, aliases: splitList(c.aliases) })),
      },
      (s) => ({ ...s, name: name.trim(), facts, brandNames, competitors: cleanCompetitors }),
      "Your business details are saved.",
    );
  }

  // ---- Markets (expert) ----
  function saveMarkets() {
    const countryList = splitList(countries).map((c) => c.toUpperCase());
    const languageList = splitList(languages).map((l) => l.toLowerCase());
    if (countryList.some((c) => !/^[A-Z]{2}$/.test(c)))
      return setErrors((e) => ({ ...e, markets: "Use 2-letter country codes separated by commas, e.g. IN, US, GB." }));
    if (languageList.length === 0 || languageList.some((l) => !/^[a-z]{2,3}(-[a-z]{2})?$/.test(l)))
      return setErrors((e) => ({ ...e, markets: "Add at least one language code, e.g. en or hi." }));
    void patch("markets", { countries: countryList, languages: languageList }, (s) => ({ ...s, countries: countryList, languages: languageList }));
  }

  const freqAllowed = (f: ScheduleFrequency) => {
    const d = frequencyDays(f);
    return d === null || d >= plan.minScanIntervalDays;
  };
  const adminNote = !isAdmin && <p className="pb-2 text-xs text-muted">Ask the Owner to change this.</p>;

  return (
    <div className="space-y-6">
      {!canEdit && (
        <Notice tone="info" title="View only">
          You can see these settings but not change them. Ask the Owner if something needs changing.
        </Notice>
      )}

      {/* My business */}
      <Card as="section">
        <CardHeader title="My business" description="We use these to ask AI the right questions and spot you in answers." icon={<Briefcase />} />
        <CardBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Business name" htmlFor="ps-name" required>
              <Input id="ps-name" value={name} maxLength={120} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Website" htmlFor="ps-url" hint="To follow a different website, add it as a new one.">
              <Input id="ps-url" value={initial.websiteUrl} readOnly aria-describedby={fieldDescribedBy("ps-url", { hint: true })} />
            </Field>
            <Field label="City" htmlFor="ps-city" optional>
              <Input id="ps-city" value={city} maxLength={120} disabled={!canEdit} placeholder="e.g. Pune" onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="What you sell" htmlFor="ps-sells" optional className="sm:col-span-2">
              <Textarea
                id="ps-sells"
                rows={2}
                value={sells}
                maxLength={300}
                disabled={!canEdit}
                placeholder="e.g. Custom birthday and wedding cakes"
                onChange={(e) => setSells(e.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-small font-medium text-fg">
              <Tag aria-hidden size={14} className="text-muted" /> Other names people use for you
            </h3>
            <ul className="space-y-2">
              {brands.map((b, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Input
                    aria-label={`Other name ${i + 1}`}
                    value={b}
                    maxLength={120}
                    disabled={!canEdit}
                    placeholder="e.g. a short form or common misspelling"
                    onChange={(e) => setBrands((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove name ${b || i + 1}`}
                    disabled={!canEdit || (brands.length <= 1 && !b)}
                    onClick={() => setBrands((xs) => (xs.length <= 1 ? [""] : xs.filter((_, j) => j !== i)))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" icon={<Plus />} disabled={!canEdit || brands.length >= 19} onClick={() => setBrands((xs) => [...xs, ""])}>
              Add a name
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="text-small font-medium text-fg">Competitors</h3>
            {competitors.length === 0 && <p className="text-small text-muted">Add the two or three businesses you lose customers to.</p>}
            <ul className="space-y-3">
              {competitors.map((c, i) => {
                const upd = (p: Partial<CompetitorRow>) => setCompetitors((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <li key={i} className="grid gap-2 rounded-xl bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Field label="Name" htmlFor={`ps-comp-${i}-name`}>
                      <Input id={`ps-comp-${i}-name`} value={c.name} maxLength={120} disabled={!canEdit} onChange={(e) => upd({ name: e.target.value })} />
                    </Field>
                    <Field label="Website" htmlFor={`ps-comp-${i}-domain`} optional>
                      <Input id={`ps-comp-${i}-domain`} value={c.domain} placeholder="example.com" disabled={!canEdit} onChange={(e) => upd({ domain: e.target.value })} />
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
                    {expert && (
                      <Field label="Other names" htmlFor={`ps-comp-${i}-aliases`} optional className="sm:col-span-3">
                        <Input id={`ps-comp-${i}-aliases`} value={c.aliases} placeholder="Comma separated" disabled={!canEdit} onChange={(e) => upd({ aliases: e.target.value })} />
                      </Field>
                    )}
                  </li>
                );
              })}
            </ul>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus />}
              disabled={!canEdit || competitors.length >= 20}
              onClick={() => setCompetitors((xs) => [...xs, { name: "", domain: "", aliases: "" }])}
            >
              Add competitor
            </Button>
          </div>
          {errors.business && (
            <p className="text-small text-danger" role="alert">
              {errors.business}
            </p>
          )}
        </CardBody>
        <CardFooter>
          <div className="flex w-full items-center justify-end gap-2">
            {businessDirty && busy !== "business" && <span className="mr-auto text-small text-muted">Unsaved changes</span>}
            <Button onClick={saveBusiness} loading={busy === "business"} loadingText="Saving…" disabled={!businessDirty || !canEdit}>
              Save
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Connect website */}
      <Card as="section" padding="md">
        <div className="flex flex-wrap items-center gap-4">
          <Plug aria-hidden size={20} className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="text-h4 text-fg">Connect website</h2>
            <p className="text-small text-muted">Connect your website so approved fixes can go live by themselves.</p>
          </div>
          <LinkButton href={integrationsHref} variant="secondary">
            Connect website
          </LinkButton>
        </div>
      </Card>

      {/* Automatic checks */}
      <Card as="section">
        <CardHeader title="Automatic checks" description="We check again by ourselves, so you can see things change." icon={<CalendarClock />} />
        <CardBody>
          {adminNote}
          <div className="grid gap-5 sm:grid-cols-2">
            {(
              [
                ["crawl", "Website", ["weekly", "monthly", "off"]],
                ["visibility", "AI", saved.schedule.visibility === "weekly" ? ["weekly", "monthly", "off"] : ["monthly", "off"]],
              ] as const
            ).map(([kind, label, options]) => (
              <Field key={kind} label={label} htmlFor={`ps-sched-${kind}`} hint={nextRunText(saved.schedule[kind], plan.minScanIntervalDays, lastRuns[kind])}>
                <Select
                  id={`ps-sched-${kind}`}
                  value={saved.schedule[kind]}
                  disabled={!isAdmin || busy === "schedule"}
                  aria-describedby={fieldDescribedBy(`ps-sched-${kind}`, { hint: true })}
                  onChange={(e) => {
                    const schedule = { ...saved.schedule, [kind]: e.target.value as ScheduleFrequency };
                    void patch("schedule", { settings: { schedule } }, (s) => ({ ...s, schedule }), "Automatic checks saved.");
                  }}
                >
                  {(options as readonly ScheduleFrequency[]).map((f) => (
                    <option key={f} value={f} disabled={!freqAllowed(f)}>
                      {FREQ_LABEL[f]}
                      {!freqAllowed(f) ? " (not on your plan)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
          {errors.schedule && (
            <p className="mt-2 text-small text-danger" role="alert">
              {errors.schedule}
            </p>
          )}
        </CardBody>
      </Card>

      {/* Auto-fix + Pause */}
      <Card as="section">
        <CardHeader title="Changes to your website" icon={<Wand2 />} />
        <CardBody className="divide-y divide-border">
          {adminNote}
          <SwitchRow
            id="ps-autofix"
            label="Make small safe fixes without asking"
            help={
              expert
                ? `Class B types: ${CLASS_B_TYPES.join(", ")}. Never on your homepage or key pages, and only when the change can be undone.`
                : `${CLASS_B_TYPES.map((t) => SAFE_FIX_NAMES[t] ?? t).join(", ")}. Never on your homepage or key pages, and always undoable.`
            }
            checked={saved.autoFix}
            disabled={!isAdmin}
            busy={busy === "autofix"}
            onChange={(next) =>
              void patch(
                "autofix",
                { settings: { automation: { allowClassB: next ? [...CLASS_B_TYPES] : [] } } },
                (s) => ({ ...s, autoFix: next }),
                next ? "Small safe fixes will go live by themselves." : "Every fix will wait for your OK.",
              )
            }
          />
          <SwitchRow
            id="ps-paused"
            label="Pause all changes"
            help="While this is on, nothing changes on your website — not even fixes you already approved."
            checked={saved.paused}
            disabled={!isAdmin}
            busy={busy === "paused"}
            onChange={(next) =>
              void patch("paused", { settings: { paused: next } }, (s) => ({ ...s, paused: next }), next ? "All changes are paused." : "Changes can go live again.")
            }
          />
          {saved.paused && (
            <div className="pt-3">
              <Notice tone="warning" icon={<PauseCircle />} title="Changes are paused">
                Nothing will go live on your website until you switch this off.
              </Notice>
            </div>
          )}
          {(errors.autofix || errors.paused) && (
            <p className="pt-2 text-small text-danger" role="alert">
              {errors.autofix || errors.paused}
            </p>
          )}
        </CardBody>
      </Card>

      {/* Emails */}
      <Card as="section">
        <CardHeader title="Emails" description="Sent to the people who look after this account." icon={<Mail />} />
        <CardBody className="divide-y divide-border">
          {EMAILS.map((e) => (
            <SwitchRow
              key={e.kind}
              id={`ps-email-${e.kind}`}
              label={e.label}
              help={e.help}
              checked={saved.emails[e.kind]}
              disabled={!canEdit}
              busy={busy === `email-${e.kind}`}
              onChange={(next) =>
                void patch(
                  `email-${e.kind}`,
                  // Turning one on also turns the old all-emails switch back on, so the email can be sent.
                  { settings: { notifications: { [e.kind]: next, ...(next ? { email: true } : {}) } } },
                  (s) => ({ ...s, emails: { ...s.emails, [e.kind]: next } }),
                )
              }
            />
          ))}
        </CardBody>
      </Card>

      {team}
      {planSection}
      {preferences}

      {expert && (
        <Card as="section">
          <CardHeader title="Markets" description="Countries and languages we ask AI tools in." icon={<Globe2 />} />
          <CardBody className="grid gap-5 sm:grid-cols-2">
            <Field label="Countries" htmlFor="ps-countries" hint="2-letter codes, comma separated — e.g. IN, US, GB">
              <Input id="ps-countries" value={countries} disabled={!canEdit} onChange={(e) => setCountries(e.target.value)} />
            </Field>
            <Field label="Languages" htmlFor="ps-languages" hint="Language codes, comma separated — e.g. en, hi">
              <Input id="ps-languages" value={languages} disabled={!canEdit} onChange={(e) => setLanguages(e.target.value)} />
            </Field>
            {errors.markets && (
              <p className="text-small text-danger sm:col-span-2" role="alert">
                {errors.markets}
              </p>
            )}
          </CardBody>
          <CardFooter>
            <div className="flex w-full justify-end">
              <Button variant="secondary" size="sm" onClick={saveMarkets} loading={busy === "markets"} disabled={!canEdit}>
                Save markets
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {isAdmin && <DangerZone projectId={projectId} projectName={saved.name} />}
    </div>
  );
}
