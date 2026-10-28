"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Globe, Plus, Rocket, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { CLASS_B_TYPES } from "@/lib/policy/engine";
import { humanize } from "@/lib/dashboard/format";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Field,
  Input,
  KeyValueList,
  LinkButton,
  Meter,
  Notice,
  ProgressSteps,
  Select,
  Textarea,
  fieldDescribedBy,
  type ProgressStep,
  type StepStatus,
} from "@/components/ui";

/* ------------------------------------------------------------------ constants */

const STEPS = [
  { id: "site", label: "Your website", description: "Address and brand names" },
  { id: "market", label: "Your market", description: "What you sell and where" },
  { id: "competitors", label: "Competitors", description: "Who you're compared with" },
  { id: "automation", label: "Safety settings", description: "What we may change" },
  { id: "review", label: "Review", description: "Check and start" },
] as const;

const COUNTRIES: [string, string][] = [
  ["IN", "India"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["AE", "United Arab Emirates"],
  ["SG", "Singapore"],
  ["AU", "Australia"],
  ["CA", "Canada"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["NL", "Netherlands"],
  ["ZA", "South Africa"],
  ["NZ", "New Zealand"],
];

const LANGUAGES: [string, string][] = [
  ["en", "English"],
  ["hi", "Hindi"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["mr", "Marathi"],
  ["bn", "Bengali"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["ar", "Arabic"],
];

const B_HELP: Record<string, string> = {
  update_meta_description: "Write or improve the short summary search engines show under your page title.",
  update_title: "Improve page titles (the clickable headline in search results).",
  update_image_alt: "Add missing image descriptions, which also help visually impaired visitors.",
  update_og_tags: "Fill in the preview title and image used when your pages are shared.",
};

const DONE = ["succeeded", "succeeded_with_warnings"];
const FAILED = ["failed", "cancelled", "canceled", "rollback_failed"];

/* ------------------------------------------------------------------ helpers */

function splitList(s: string): string[] {
  return Array.from(
    new Set(
      s
        .split(/[\n,]/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeUrl(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function hostFrom(s: string): string | null {
  try {
    return new URL(normalizeUrl(s)).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function guessBrand(host: string): string {
  const label = host.split(".")[0] ?? "";
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

type Errors = Partial<Record<string, string>>;

interface DashboardPoll {
  item: {
    activePromptCount: number;
    recentRuns: { id: string; kind: "crawl" | "visibility"; status: string; progress: { done: number; total: number }; error?: string | null }[];
  };
}

type KickoffState = "pending" | "running" | "done" | "error";

/* ------------------------------------------------------------------ component */

export function OnboardingWizard({ maxPagesLimit, initialWebsite = "" }: { maxPagesLimit: number; initialWebsite?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});

  const [websiteUrl, setWebsiteUrl] = useState(initialWebsite);
  const [brand, setBrand] = useState("");
  const [aliases, setAliases] = useState("");
  const [name, setName] = useState("");
  const [categories, setCategories] = useState("");
  const [audience, setAudience] = useState("");
  const [country, setCountry] = useState("IN");
  const [language, setLanguage] = useState("en");
  const [competitors, setCompetitors] = useState<{ name: string; domain: string }[]>([{ name: "", domain: "" }]);
  const [keywords, setKeywords] = useState("");
  const [allowB, setAllowB] = useState<string[]>([]);
  const [maxPages, setMaxPages] = useState(Math.min(50, maxPagesLimit));

  // launch state
  const [launched, setLaunched] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [kick, setKick] = useState<Record<"crawl" | "prompts" | "visibility", { state: KickoffState; error?: string }>>({
    crawl: { state: "pending" },
    prompts: { state: "pending" },
    visibility: { state: "pending" },
  });
  const [poll, setPoll] = useState<DashboardPoll["item"] | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const busyRef = useRef(false);
  const [running, setRunning] = useState(false);

  const brandNames = [brand.trim(), ...splitList(aliases)].filter(Boolean);

  /* ---------------- validation */

  function validate(i: number): Errors {
    const e: Errors = {};
    if (i === 0) {
      const host = hostFrom(websiteUrl);
      if (!websiteUrl.trim()) e.url = "Enter your website address, e.g. acme.com";
      else if (!host || !host.includes(".")) e.url = "That doesn't look like a website address. Try something like acme.com";
      if (!brand.trim()) e.brand = "Add the name your customers know you by.";
    }
    if (i === 3 && (!Number.isFinite(maxPages) || maxPages < 1 || maxPages > maxPagesLimit))
      e.maxPages = `Choose a number between 1 and ${maxPagesLimit}.`;
    return e;
  }

  function next() {
    const v = validate(step);
    setErrors(v);
    const first = Object.keys(v)[0];
    if (first) {
      document.getElementById(`ob-${first}`)?.focus();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function payload() {
    const url = normalizeUrl(websiteUrl);
    const host = hostFrom(url) ?? url;
    return {
      name: name.trim() || brandNames[0] || host,
      websiteUrl: url,
      brandNames,
      categories: splitList(categories),
      audience: audience.trim() || undefined,
      countries: [country],
      languages: [language],
      competitors: competitors
        .filter((c) => c.name.trim())
        .map((c) => ({ name: c.name.trim(), domain: hostFrom(c.domain) ?? (c.domain.trim() || undefined), aliases: [] })),
      keywords: splitList(keywords),
      settings: { maxPagesPerCrawl: maxPages, automation: { allowClassB: allowB } },
    };
  }

  /* ---------------- launch sequence */

  async function launch() {
    for (let i = 0; i < 4; i++) {
      const v = validate(i);
      if (Object.keys(v).length) {
        setStep(i);
        setErrors(v);
        return;
      }
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setRunning(true);
    setErrors({});
    setLaunched(true);
    setCreateError(null);

    let id = projectId;
    if (!id) {
      try {
        const r = await api<{ item: { id: string } }>("/api/projects", { body: payload() });
        id = r.item.id;
        setProjectId(id);
      } catch (e) {
        setCreateError(errorMessage(e));
        busyRef.current = false;
        setRunning(false);
        return;
      }
    }

    const setK = (k: keyof typeof kick, v: { state: KickoffState; error?: string }) => setKick((x) => ({ ...x, [k]: v }));
    const current = kick;

    if (current.crawl.state !== "done") {
      setK("crawl", { state: "running" });
      try {
        await api(`/api/projects/${id}/crawl-runs`, { body: {} });
        setK("crawl", { state: "done" });
      } catch (e) {
        setK("crawl", { state: "error", error: errorMessage(e) });
      }
    }

    let promptsOk = current.prompts.state === "done";
    if (!promptsOk) {
      setK("prompts", { state: "running" });
      try {
        await api(`/api/projects/${id}/prompts`, { body: { generate: true, save: true } });
        setK("prompts", { state: "done" });
        promptsOk = true;
      } catch (e) {
        setK("prompts", { state: "error", error: errorMessage(e) });
      }
    }

    if (current.visibility.state !== "done") {
      if (promptsOk) {
        setK("visibility", { state: "running" });
        try {
          await api(`/api/projects/${id}/visibility-runs`, { body: {} });
          setK("visibility", { state: "done" });
        } catch (e) {
          setK("visibility", { state: "error", error: errorMessage(e) });
        }
      } else {
        setK("visibility", { state: "error", error: "Skipped because no questions were created. You can add them later on the Prompts page." });
      }
    }
    busyRef.current = false;
    setRunning(false);
  }

  /* ---------------- polling */

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await api<DashboardPoll>(`/api/projects/${projectId}/dashboard`);
        if (alive) setPoll(r.item);
      } catch {
        /* transient — try again next tick */
      }
    };
    load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [projectId]);

  const crawlRun = poll?.recentRuns.find((r) => r.kind === "crawl");
  const visRun = poll?.recentRuns.find((r) => r.kind === "visibility");
  const crawlDone = !!crawlRun && DONE.includes(crawlRun.status);
  const crawlFailed = kick.crawl.state === "error" || (!!crawlRun && FAILED.includes(crawlRun.status));
  const kickoffSettled = (["crawl", "prompts", "visibility"] as const).every((k) => kick[k].state === "done" || kick[k].state === "error");

  useEffect(() => {
    if (!projectId || redirecting) return;
    if (crawlDone && kickoffSettled) {
      setRedirecting(true);
      const t = setTimeout(() => {
        router.push(`/app/projects/${projectId}/report`);
        router.refresh();
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [crawlDone, kickoffSettled, projectId, redirecting, router]);

  /* ---------------- live steps */

  function liveSteps(): ProgressStep[] {
    const crawlStatus: StepStatus = crawlFailed ? "error" : crawlDone ? "done" : "active";
    const crawlDesc = createError
      ? "We couldn't create the project."
      : kick.crawl.error
        ? kick.crawl.error
        : crawlRun?.error && crawlFailed
          ? crawlRun.error
          : crawlRun && crawlRun.progress.total > 0
            ? `${crawlRun.progress.done} of ${crawlRun.progress.total} pages read`
            : crawlDone
              ? "Done"
              : "Reading your public pages (we respect robots.txt)…";

    const promptsStatus: StepStatus =
      kick.prompts.state === "done" ? "done" : kick.prompts.state === "error" ? "error" : kick.prompts.state === "running" ? "active" : "pending";
    const promptsDesc =
      kick.prompts.error ??
      (kick.prompts.state === "done"
        ? `${poll?.activePromptCount ?? "Several"} questions ready to track`
        : "Writing the questions your buyers are likely to ask AI assistants…");

    const visActive = visRun && !DONE.includes(visRun.status) && !FAILED.includes(visRun.status);
    const visStatus: StepStatus =
      kick.visibility.state === "error" || (visRun && FAILED.includes(visRun.status))
        ? "error"
        : visRun && DONE.includes(visRun.status)
          ? "done"
          : kick.visibility.state === "running" || visActive
            ? "active"
            : "pending";
    const visDesc =
      kick.visibility.error ??
      (visRun && visRun.progress.total > 0
        ? `${visRun.progress.done} of ${visRun.progress.total} answers collected${visStatus === "active" ? " — this keeps running in the background" : ""}`
        : "Checking whether AI answers mention, recommend or cite you…");

    const reportStatus: StepStatus = redirecting ? "done" : crawlDone ? "active" : "pending";
    const reportDesc = redirecting ? "Opening your report…" : crawlDone ? "Scoring your site and writing plain-English fixes…" : "Starts when the scan finishes";

    return [
      { id: "scan", label: "Scanning your website", description: crawlDesc, status: createError ? "error" : crawlStatus },
      { id: "prompts", label: "Finding the questions buyers ask AI", description: promptsDesc, status: promptsStatus },
      { id: "ask", label: "Asking AI engines", description: visDesc, status: visStatus },
      { id: "report", label: "Building your report", description: reportDesc, status: reportStatus },
    ];
  }

  /* ---------------- render: launch view */

  if (launched) {
    const steps = liveSteps();
    const doneCount = steps.filter((s) => s.status === "done").length;
    const anyError = !!createError || steps.some((s) => s.status === "error");
    const retryable = !!createError || kick.crawl.state === "error" || kick.prompts.state === "error" || kick.visibility.state === "error";
    return (
      <div className="mx-auto max-w-2xl">
        <Card variant="elevated">
          <CardHeader
            icon={<Rocket />}
            eyebrow="Setting things up"
            title={redirecting ? "Your report is ready" : `Analysing ${hostFrom(websiteUrl) ?? "your website"}`}
            description="This usually takes a few minutes. You can leave this page — we'll keep working and notify you when results are in."
          />
          <CardBody className="space-y-6">
            <Meter value={doneCount} max={steps.length} label="Setup progress" tone="primary" size="sm" />
            <div aria-live="polite">
              <ProgressSteps label="Setup progress" steps={steps} />
            </div>
            {createError && (
              <Notice tone="danger" title="We couldn't create your project">
                {createError}
              </Notice>
            )}
            {!createError && anyError && (
              <Notice tone="warning" title="Some steps didn't start">
                You can retry now, or open the project and run them later. Results never depend on a single step.
              </Notice>
            )}
            <p className="text-xs text-muted">
              Results come from sampled AI answers and a scan of your public pages. They are measurements, not ranking guarantees.
            </p>
          </CardBody>
          <CardFooter className="flex flex-wrap justify-end gap-2">
            {createError && !running && (
              <Button variant="secondary" icon={<ArrowLeft />} onClick={() => setLaunched(false)}>
                Edit details
              </Button>
            )}
            {retryable && !running && (
              <Button variant="secondary" onClick={launch}>
                Retry failed steps
              </Button>
            )}
            {projectId && (
              <LinkButton
                href={`/app/projects/${projectId}${crawlFailed ? "" : "/report"}`}
                variant={redirecting ? "primary" : "ghost"}
                iconRight={<ArrowRight />}
              >
                {crawlFailed ? "Go to project" : redirecting ? "Open report" : "Skip to project"}
              </LinkButton>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  /* ---------------- render: form */

  const wizardSteps: ProgressStep[] = STEPS.map((s, i) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    status: i < step ? "done" : i === step ? "active" : "pending",
  }));

  const urlHost = hostFrom(websiteUrl);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="hidden md:block">
          <ProgressSteps label="Setup steps" orientation="horizontal" steps={wizardSteps} />
        </div>
        <div className="space-y-2 md:hidden">
          <div className="flex items-baseline justify-between text-small">
            <span className="font-medium text-fg">{STEPS[step].label}</span>
            <span className="text-muted">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <Meter value={step + 1} max={STEPS.length} label="Setup steps" tone="primary" size="xs" />
        </div>
      </div>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < STEPS.length - 1) next();
            else launch();
          }}
          noValidate
        >
          <CardHeader
            eyebrow={`Step ${step + 1} of ${STEPS.length}`}
            title={
              [
                "Which website should we look at?",
                "Who do you sell to?",
                "Who are you compared with?",
                "What may we change for you?",
                "Ready to start?",
              ][step]
            }
            description={
              [
                "We'll read your public pages, check them for problems, and see how AI assistants talk about you.",
                "This helps us ask AI the same kinds of questions your real customers ask.",
                "AI answers often list several businesses. We'll show how often you appear next to these.",
                "You stay in control. Nothing is changed on your website unless you allow it here or approve it later.",
                "Check your details. You can change most of them later in the project.",
              ][step]
            }
          />
          <CardBody className="space-y-5 py-6">
            {step === 0 && (
              <>
                <Field
                  label="Website address"
                  htmlFor="ob-url"
                  required
                  error={errors.url}
                  hint="Your home page, e.g. acme.com. We only read public pages and follow your robots.txt rules."
                >
                  <div className="relative">
                    <Globe size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <Input
                      id="ob-url"
                      inputMode="url"
                      autoComplete="url"
                      autoFocus
                      placeholder="acme.com"
                      className="pl-9"
                      value={websiteUrl}
                      invalid={!!errors.url}
                      aria-describedby={fieldDescribedBy("ob-url", { hint: true, error: errors.url })}
                      onChange={(e) => {
                        setWebsiteUrl(e.target.value);
                        if (errors.url) setErrors((x) => ({ ...x, url: undefined }));
                      }}
                      onBlur={() => {
                        const h = hostFrom(websiteUrl);
                        if (h && h.includes(".") && !brand.trim()) setBrand(guessBrand(h));
                      }}
                      required
                    />
                  </div>
                </Field>
                <Field
                  label="Business or brand name"
                  htmlFor="ob-brand"
                  required
                  error={errors.brand}
                  hint="The name customers know you by. We look for it in AI answers."
                >
                  <Input
                    id="ob-brand"
                    placeholder="Acme Tools"
                    value={brand}
                    maxLength={120}
                    invalid={!!errors.brand}
                    aria-describedby={fieldDescribedBy("ob-brand", { hint: true, error: errors.brand })}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      if (errors.brand) setErrors((x) => ({ ...x, brand: undefined }));
                    }}
                    required
                  />
                </Field>
                <Field
                  label="Other names"
                  htmlFor="ob-aliases"
                  optional
                  hint="Add the names people use for your business — short forms, old names, product names. One per line or comma-separated."
                >
                  <Textarea
                    id="ob-aliases"
                    rows={2}
                    placeholder={"Acme\nAcme Hardware"}
                    value={aliases}
                    aria-describedby="ob-aliases-hint"
                    onChange={(e) => setAliases(e.target.value)}
                  />
                </Field>
                <Field label="Project name" htmlFor="ob-name" optional hint="Just for you. We'll use your brand name if you leave this empty.">
                  <Input
                    id="ob-name"
                    placeholder={brand.trim() || urlHost || "Acme Tools"}
                    value={name}
                    maxLength={120}
                    aria-describedby="ob-name-hint"
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <Field
                  label="What do you sell?"
                  htmlFor="ob-cat"
                  optional
                  hint="Describe your products or services the way a customer would search for them. Comma-separated, e.g. hardware store, power tools."
                >
                  <Input
                    id="ob-cat"
                    placeholder="power tools, hardware store"
                    value={categories}
                    aria-describedby="ob-cat-hint"
                    onChange={(e) => setCategories(e.target.value)}
                  />
                </Field>
                <Field
                  label="Who are your customers?"
                  htmlFor="ob-aud"
                  optional
                  hint="One or two sentences. It helps us write realistic questions."
                >
                  <Textarea
                    id="ob-aud"
                    rows={3}
                    placeholder="Homeowners and small contractors in Pune looking for reliable tools at fair prices"
                    value={audience}
                    maxLength={500}
                    aria-describedby="ob-aud-hint"
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Main country" htmlFor="ob-country" hint="Where most of your customers are.">
                    <Select id="ob-country" value={country} onChange={(e) => setCountry(e.target.value)} aria-describedby="ob-country-hint">
                      {COUNTRIES.map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Language" htmlFor="ob-lang" hint="The language your customers ask questions in.">
                    <Select id="ob-lang" value={language} onChange={(e) => setLanguage(e.target.value)} aria-describedby="ob-lang-hint">
                      {LANGUAGES.map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <fieldset className="space-y-3">
                  <legend className="text-small font-medium text-fg">
                    Competitors <span className="font-normal text-muted">(optional)</span>
                  </legend>
                  <p className="text-xs text-muted">Add up to 20. The website is optional but helps us tell similar names apart.</p>
                  <ul className="space-y-2">
                    {competitors.map((c, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-2 animate-fade-in">
                        <span className="hidden w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted sm:block">{i + 1}</span>
                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`comp-name-${i}`} className="sr-only">
                              Competitor {i + 1} name
                            </label>
                            <Input
                              id={`comp-name-${i}`}
                              placeholder="Business name"
                              value={c.name}
                              onChange={(e) => setCompetitors((xs) => xs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                            />
                          </div>
                          <div>
                            <label htmlFor={`comp-domain-${i}`} className="sr-only">
                              Competitor {i + 1} website
                            </label>
                            <Input
                              id={`comp-domain-${i}`}
                              placeholder="competitor.com"
                              inputMode="url"
                              value={c.domain}
                              onChange={(e) => setCompetitors((xs) => xs.map((x, j) => (j === i ? { ...x, domain: e.target.value } : x)))}
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove competitor ${i + 1}`}
                          onClick={() =>
                            setCompetitors((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : [{ name: "", domain: "" }]))
                          }
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {competitors.length < 20 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus />}
                      onClick={() => setCompetitors((xs) => [...xs, { name: "", domain: "" }])}
                    >
                      Add competitor
                    </Button>
                  )}
                </fieldset>
                <Field
                  label="Topics you want to be found for"
                  htmlFor="ob-kw"
                  optional
                  hint="Words or phrases customers use when looking for what you offer. One per line or comma-separated. We use them to write the questions we ask AI."
                >
                  <Textarea
                    id="ob-kw"
                    rows={4}
                    placeholder={"best cordless drill\nhardware store near me\ntool rental Pune"}
                    value={keywords}
                    aria-describedby="ob-kw-hint"
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <fieldset className="space-y-3">
                  <legend className="text-small font-medium text-fg">Small fixes we may apply automatically</legend>
                  <p className="text-xs text-muted">
                    Only works once you connect your website platform. We save the old version first so any change can be undone. Leave
                    these unticked and every change will wait for your approval. Bigger changes (like page content) always need your
                    approval, and risky changes are never automated.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CLASS_B_TYPES.map((t) => {
                      const checked = allowB.includes(t);
                      return (
                        <label
                          key={t}
                          className={
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-surface-2 " +
                            (checked ? "border-primary bg-primary-soft" : "border-border")
                          }
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                            checked={checked}
                            onChange={(e) => setAllowB((xs) => (e.target.checked ? [...xs, t] : xs.filter((x) => x !== t)))}
                          />
                          <span>
                            <span className="block text-small font-medium text-fg">{humanize(t)}</span>
                            <span className="mt-0.5 block text-xs text-muted">{B_HELP[t] ?? ""}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <Field
                  label="How many pages should we read each scan?"
                  htmlFor="ob-maxPages"
                  error={errors.maxPages}
                  hint={`More pages give a fuller picture but take longer. Your plan allows up to ${maxPagesLimit}.`}
                >
                  <Input
                    id="ob-maxPages"
                    type="number"
                    min={1}
                    max={maxPagesLimit}
                    value={Number.isFinite(maxPages) ? maxPages : ""}
                    invalid={!!errors.maxPages}
                    aria-describedby={fieldDescribedBy("ob-maxPages", { hint: true, error: errors.maxPages })}
                    onChange={(e) => setMaxPages(e.target.valueAsNumber)}
                    className="max-w-40 tabular-nums"
                  />
                </Field>
              </>
            )}

            {step === 4 && (
              <>
                <KeyValueList
                  layout="grid"
                  columns={2}
                  items={[
                    { label: "Website", value: normalizeUrl(websiteUrl) },
                    { label: "Names we look for", value: brandNames.join(", ") },
                    { label: "What you sell", value: splitList(categories).join(", ") || "Not set" },
                    {
                      label: "Market",
                      value: `${COUNTRIES.find(([c]) => c === country)?.[1] ?? country} · ${LANGUAGES.find(([l]) => l === language)?.[1] ?? language}`,
                    },
                    {
                      label: "Competitors",
                      value:
                        competitors
                          .filter((c) => c.name.trim())
                          .map((c) => c.name.trim())
                          .join(", ") || "None yet",
                    },
                    { label: "Topics", value: splitList(keywords).slice(0, 8).join(", ") || "We'll suggest some" },
                    { label: "Automatic fixes", value: allowB.map(humanize).join(", ") || "None — every change waits for you" },
                    { label: "Pages per scan", value: `${maxPages} pages` },
                  ]}
                />
                <Notice tone="info" title="What happens next">
                  We&apos;ll scan your website, write the questions buyers ask, ask AI assistants those questions and build your report.
                  This uses credits from your plan. Results are measurements of sampled answers — not ranking guarantees.
                </Notice>
              </>
            )}
          </CardBody>
          <CardFooter className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              icon={<ArrowLeft />}
              onClick={() => {
                setErrors({});
                setStep((s) => Math.max(0, s - 1));
              }}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="submit" iconRight={<ArrowRight />}>
                Continue
              </Button>
            ) : (
              <Button type="submit" icon={<Rocket />}>
                Create project & start
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
