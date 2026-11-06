"use client";
// Setup — exactly 4 screens (brief §5.3): Your website → Is this right? → Competitors & SEO keywords →
// Questions we'll ask AI,
// then the progress screen. The tool fills in everything it can; the owner only types the website address.
// Removed from setup on purpose: automatic-fix ticks (off), pages per check (plan maximum), project name and
// other names (from the business name). Schedules stay on (website weekly, AI monthly).
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Globe, Plus, Search, Sparkles, Users } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { BRAND } from "@/lib/brand";
import { joinNames } from "@/lib/setup/names";
import { COUNTRIES, LANGUAGES, countryLabel, emptyFacts, nameFromHost, projectFieldsFromFacts, type BusinessFacts } from "@/lib/setup/facts";
import { normalizeWebsite, preferredWebsite, websiteError, websiteHost } from "@/lib/setup/website";
import { Button, Card, CardBody, Field, Input, Notice, Select, Spinner } from "@/components/ui";
import { LimitCard, type LimitInfo } from "./limit-card";
import { SetupProgress } from "./setup-progress";

type Screen = "limit" | "website" | "facts" | "competitors" | "questions" | "running";
const SCREEN_NO: Partial<Record<Screen, number>> = { website: 1, facts: 2, competitors: 3, questions: 4 };

interface Competitor {
  name: string;
  domain?: string;
  checked: boolean;
}
interface Keyword {
  text: string;
  checked: boolean;
}
interface Question {
  text: string;
  intent?: string;
  topic?: string | null;
  locale?: string;
  checked: boolean;
}

export interface SetupWizardProps {
  initialWebsite?: string;
  /** True when this is the workspace's first website (warmer copy). */
  firstWebsite?: boolean;
  /** How many customer questions the plan asks per AI check (10–25). */
  questionCount: number;
  /** Set when the plan's website limit is already used. */
  limit: LimitInfo | null;
  /** AI assistants this plan's checks ask, e.g. ["ChatGPT", "Gemini", "Claude"]. */
  assistants?: string[];
}

function ContactLink() {
  return (
    <a className="font-medium text-primary hover:underline" href={`mailto:${BRAND.supportEmail}`}>
      contact us
    </a>
  );
}

function StepLabel({ screen }: { screen: Screen }) {
  const n = SCREEN_NO[screen];
  if (!n) return null;
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="eyebrow">Step {n} of 4</span>
      <span aria-hidden className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={"h-1 flex-1 rounded-full " + (i <= n ? "bg-primary" : "bg-score-track")} />
        ))}
      </span>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center" role="status" aria-live="polite">
      <Spinner size={28} className="text-primary" />
      <p className="text-body text-muted">{text}</p>
    </div>
  );
}

const tickBox =
  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary";

const MAX_KEYWORDS = 40;
const DEFAULT_ASSISTANTS = ["ChatGPT", "Gemini", "Claude", "Perplexity", "Grok"];

export function SetupWizard({ initialWebsite = "", firstWebsite = true, questionCount, limit, assistants = DEFAULT_ASSISTANTS }: SetupWizardProps) {
  const [screen, setScreen] = useState<Screen>(limit ? "limit" : "website");
  const [loading, setLoading] = useState<string | null>(null);

  // Screen 1
  const [website, setWebsite] = useState(initialWebsite);
  const [websiteErr, setWebsiteErr] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  // Screen 2
  const [facts, setFacts] = useState<BusinessFacts>(emptyFacts());
  const [factsNote, setFactsNote] = useState<string | null>(null);
  const [nameErr, setNameErr] = useState<string | null>(null);
  // Screen 3
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorsNote, setCompetitorsNote] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newComp, setNewComp] = useState({ name: "", domain: "" });
  const [newCompErr, setNewCompErr] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordErr, setNewKeywordErr] = useState<string | null>(null);
  // Screen 4
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsErr, setQuestionsErr] = useState<string | null>(null);
  const [questionsTickErr, setQuestionsTickErr] = useState<string | null>(null);
  const reqId = useRef(0);

  const host = websiteHost(siteUrl || website) ?? "";

  /* ---------------- screen 1 → 2: read the website */

  async function submitWebsite(e?: FormEvent) {
    e?.preventDefault();
    const err = websiteError(website);
    setWebsiteErr(err);
    if (err) {
      document.getElementById("setup-website")?.focus();
      return;
    }
    const typed = normalizeWebsite(website);
    const h = websiteHost(typed) ?? "";
    const id = ++reqId.current;
    setLoading("Reading your website…");
    setScreen("facts");
    let next: BusinessFacts = emptyFacts(nameFromHost(h));
    let note: string | null = null;
    let url = typed;
    try {
      const r = await api<{ item: { facts: BusinessFacts; source: "ai" | "website" | "none"; finalUrl: string; problem?: string } }>(
        "/api/setup/understand",
        { body: { website: typed } },
      );
      next = { ...next, ...r.item.facts, name: r.item.facts.name || next.name };
      url = preferredWebsite(typed, r.item.finalUrl);
      note = r.item.problem ?? null;
    } catch (e) {
      note = `${errorMessage(e)} Fill in the details below — it only takes a minute.`;
    }
    if (id !== reqId.current) return;
    setSiteUrl(url);
    setFacts(next);
    setFactsNote(note);
    setLoading(null);
    setTimeout(() => document.getElementById("setup-heading")?.focus(), 0);
  }

  /* ---------------- screen 2 → 3: suggest competitors */

  async function confirmFacts(e?: FormEvent) {
    e?.preventDefault();
    if (!facts.name.trim()) {
      setNameErr("Add your business name.");
      document.getElementById("setup-name")?.focus();
      return;
    }
    setNameErr(null);
    const id = ++reqId.current;
    setLoading("Finding your competitors and SEO keywords…");
    setScreen("competitors");
    let items: Competitor[] = [];
    let note: string | null = null;
    const body = { facts, website: siteUrl || normalizeWebsite(website) };
    const [compRes, kwRes] = await Promise.allSettled([
      api<{ items: { name: string; domain?: string }[]; source: string }>("/api/setup/competitors", { body }),
      api<{ item: { picked: string[]; more: string[] } }>("/api/setup/keywords", { body }),
    ]);
    if (compRes.status === "fulfilled") {
      items = compRes.value.items.map((c) => ({ ...c, checked: true }));
      if (!items.length) note = "We couldn't suggest competitors this time. Add the ones you know, or skip this part.";
    } else {
      note = "We couldn't suggest competitors just now. Add the ones you know, or skip this part.";
    }
    if (id !== reqId.current) return;
    if (kwRes.status === "fulfilled") {
      const suggested = [
        ...kwRes.value.item.picked.map((text) => ({ text, checked: true })),
        ...kwRes.value.item.more.map((text) => ({ text, checked: false })),
      ];
      // Keep keywords the owner typed or ticked if they came back to this screen.
      setKeywords((prev) => {
        const mine = prev.filter((p) => !suggested.some((k) => k.text === p.text));
        const ticked = new Set(prev.filter((p) => p.checked).map((p) => p.text));
        return [...suggested.map((k) => (ticked.has(k.text) ? { ...k, checked: true } : k)), ...mine];
      });
    }
    // Keep anything the owner already added if they came back to this screen.
    setCompetitors((prev) => {
      const mine = prev.filter((p) => !items.some((i) => i.name.toLowerCase() === p.name.toLowerCase()));
      return [...items, ...mine];
    });
    setCompetitorsNote(note);
    setLoading(null);
  }

  function addCompetitor() {
    const name = newComp.name.trim();
    if (!name) {
      setNewCompErr("Add the business name.");
      return;
    }
    const domain = newComp.domain.trim() ? (websiteHost(newComp.domain) ?? undefined) : undefined;
    if (newComp.domain.trim() && !domain) {
      setNewCompErr("That website doesn't look right. Try something like example.com, or leave it empty.");
      return;
    }
    setCompetitors((xs) => [...xs, { name: name.slice(0, 120), domain, checked: true }]);
    setNewComp({ name: "", domain: "" });
    setNewCompErr(null);
    setAdding(false);
  }

  function addKeyword() {
    const text = newKeyword.toLowerCase().replace(/\s+/g, " ").trim();
    if (text.length < 2) {
      setNewKeywordErr("Type a word or short phrase people search for.");
      return;
    }
    if (text.length > 80) {
      setNewKeywordErr("Keep it under 80 characters.");
      return;
    }
    setKeywords((xs) => (xs.some((k) => k.text === text) ? xs.map((k) => (k.text === text ? { ...k, checked: true } : k)) : [...xs, { text, checked: true }]));
    setNewKeyword("");
    setNewKeywordErr(null);
  }

  /* ---------------- screen 3 → 4: write the customer questions */

  async function loadQuestions() {
    const id = ++reqId.current;
    setLoading("Writing the questions your customers ask…");
    setScreen("questions");
    setQuestionsErr(null);
    try {
      const r = await api<{ items: Omit<Question, "checked">[] }>("/api/setup/questions", {
        body: {
          facts,
          competitors: competitors.filter((c) => c.checked).map(({ name, domain }) => ({ name, ...(domain ? { domain } : {}) })),
          keywords: keywords.filter((k) => k.checked).map((k) => k.text),
        },
      });
      if (id !== reqId.current) return;
      setQuestions(r.items.map((q) => ({ ...q, checked: true })));
      if (!r.items.length) setQuestionsErr("We couldn't write questions this time. Please try again.");
    } catch (e) {
      if (id !== reqId.current) return;
      setQuestionsErr(errorMessage(e));
    }
    setLoading(null);
  }

  /* ---------------- screen 4 → progress */

  function start() {
    if (!questions.some((q) => q.checked)) {
      setQuestionsTickErr("Tick at least one question, so we know what to ask AI.");
      return;
    }
    setQuestionsTickErr(null);
    setScreen("running");
  }

  const chosenCompetitors = competitors.filter((c) => c.checked);
  const chosenQuestions = questions.filter((q) => q.checked);
  const chosenKeywords = keywords.filter((k) => k.checked);

  /* ---------------- render */

  if (screen === "running") {
    const url = siteUrl || normalizeWebsite(website);
    return (
      <SetupProgress
        host={host}
        project={{
          ...projectFieldsFromFacts(facts),
          websiteUrl: url,
          competitors: chosenCompetitors.map((c) => ({ name: c.name, ...(c.domain ? { domain: c.domain } : {}), aliases: [] })),
          keywords: chosenKeywords.map((k) => k.text),
          facts,
        }}
        questions={chosenQuestions.map(({ text, intent, topic, locale }) => ({ text, ...(intent ? { intent } : {}), ...(topic ? { topic } : {}), ...(locale ? { locale } : {}) }))}
        onEdit={() => setScreen("questions")}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {screen === "limit" && limit && <LimitCard limit={limit} onReplaced={() => setScreen("website")} />}

      {screen === "website" && (
        <Card variant="elevated">
          <CardBody>
            <form onSubmit={submitWebsite} noValidate className="space-y-5">
              <StepLabel screen="website" />
              <div>
                <h1 id="setup-heading" tabIndex={-1} className="text-h3 text-fg outline-none">
                  {firstWebsite ? "Your website" : "Your other website"}
                </h1>
                <p className="mt-1 text-body text-muted">We&apos;ll read it and fill in the rest for you.</p>
              </div>
              <Field label="Website address" htmlFor="setup-website" error={websiteErr}>
                <Input
                  id="setup-website"
                  inputSize="lg"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="sharmasweets.in"
                  autoFocus={!initialWebsite}
                  value={website}
                  invalid={!!websiteErr}
                  onChange={(e) => {
                    setWebsite(e.target.value);
                    if (websiteErr) setWebsiteErr(null);
                  }}
                />
              </Field>
              <Button type="submit" size="lg" fullWidth iconRight={<ArrowRight />} autoFocus={!!initialWebsite}>
                Next
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {screen === "facts" && (
        <Card variant="elevated">
          <CardBody>
            {loading ? (
              <>
                <StepLabel screen="facts" />
                <Loading text={loading} />
              </>
            ) : (
              <form onSubmit={confirmFacts} noValidate className="space-y-5">
                <StepLabel screen="facts" />
                <div>
                  <h1 id="setup-heading" tabIndex={-1} className="text-h3 text-fg outline-none">
                    Is this right?
                  </h1>
                  <p className="mt-1 text-body text-muted">
                    {factsNote ? "Fill in what you can. You can change it later." : `We read ${host || "your website"}. Change anything that's wrong.`}
                  </p>
                </div>
                {factsNote && (
                  <Notice
                    tone="warning"
                    actions={
                      <Button variant="secondary" size="sm" onClick={() => submitWebsite()}>
                        Retry
                      </Button>
                    }
                  >
                    {factsNote}
                  </Notice>
                )}
                <Field label="Business name" htmlFor="setup-name" error={nameErr}>
                  <Input
                    id="setup-name"
                    autoComplete="organization"
                    value={facts.name}
                    invalid={!!nameErr}
                    placeholder="Sharma Sweets"
                    onChange={(e) => {
                      setFacts((f) => ({ ...f, name: e.target.value }));
                      if (nameErr) setNameErr(null);
                    }}
                  />
                </Field>
                <Field label="What you sell" htmlFor="setup-sells">
                  <Input
                    id="setup-sells"
                    value={facts.sells}
                    placeholder="Sweets, cakes and snacks"
                    onChange={(e) => setFacts((f) => ({ ...f, sells: e.target.value }))}
                  />
                </Field>
                <Field label="Who your customers are" htmlFor="setup-customers">
                  <Input
                    id="setup-customers"
                    value={facts.customers}
                    placeholder="Families and offices nearby"
                    onChange={(e) => setFacts((f) => ({ ...f, customers: e.target.value }))}
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field label="City" htmlFor="setup-city">
                    <Input id="setup-city" autoComplete="address-level2" value={facts.city} placeholder="Pune" onChange={(e) => setFacts((f) => ({ ...f, city: e.target.value }))} />
                  </Field>
                  <Field label="Country" htmlFor="setup-country">
                    <Select id="setup-country" value={facts.country} onChange={(e) => setFacts((f) => ({ ...f, country: e.target.value }))}>
                      {!COUNTRIES.some(([c]) => c === facts.country) && <option value={facts.country}>{countryLabel(facts.country)}</option>}
                      {COUNTRIES.map(([c, label]) => (
                        <option key={c} value={c}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Language" htmlFor="setup-language">
                    <Select id="setup-language" value={facts.language} onChange={(e) => setFacts((f) => ({ ...f, language: e.target.value }))}>
                      {!LANGUAGES.some(([c]) => c === facts.language) && <option value={facts.language}>{facts.language}</option>}
                      {LANGUAGES.map(([c, label]) => (
                        <option key={c} value={c}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Button type="submit" size="lg" fullWidth icon={<Check />}>
                  Yes, correct
                </Button>
                <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => setScreen("website")}>
                  Change website
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      {screen === "competitors" && (
        <Card variant="elevated">
          <CardBody>
            <StepLabel screen="competitors" />
            {loading ? (
              <Loading text={loading} />
            ) : (
              <div className="space-y-5">
                <div>
                  <h1 id="setup-heading" tabIndex={-1} className="text-h3 text-fg outline-none">
                    Competitors and SEO keywords
                  </h1>
                  <p className="mt-1 text-body text-muted">Who you compete with, and what people search for to find you.</p>
                </div>
                <section aria-labelledby="setup-comp-title" className="space-y-3">
                <div>
                  <h2 id="setup-comp-title" className="flex items-center gap-2 text-body font-semibold text-fg">
                    <Users size={17} aria-hidden className="text-primary" /> Your competitors
                  </h2>
                  <p className="mt-0.5 text-small text-muted">We&apos;ll check if AI recommends them instead of you. Untick any that aren&apos;t real competitors.</p>
                </div>
                {competitorsNote && <Notice tone="info">{competitorsNote}</Notice>}
                {competitors.length > 0 && (
                  <ul className="space-y-2">
                    {competitors.map((c, i) => (
                      <li key={`${c.name}-${i}`}>
                        <label className={`${tickBox} ${c.checked ? "border-primary bg-primary-soft" : "border-border"}`}>
                          <input
                            type="checkbox"
                            className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
                            checked={c.checked}
                            onChange={(e) => setCompetitors((xs) => xs.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
                          />
                          <span className="min-w-0">
                            <span className="block break-words text-small font-medium text-fg">{c.name}</span>
                            {c.domain && <span className="block break-all text-xs text-muted">{c.domain}</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {adding ? (
                  <div className="space-y-3 rounded-xl border border-border p-3">
                    <Field label="Competitor name" htmlFor="setup-comp-name" error={newCompErr}>
                      <Input
                        id="setup-comp-name"
                        autoFocus
                        value={newComp.name}
                        placeholder="Kumar Bakers"
                        onChange={(e) => setNewComp((x) => ({ ...x, name: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCompetitor();
                          }
                        }}
                      />
                    </Field>
                    <Field label="Their website" htmlFor="setup-comp-domain" optional>
                      <Input
                        id="setup-comp-domain"
                        inputMode="url"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={newComp.domain}
                        placeholder="kumarbakers.in"
                        onChange={(e) => setNewComp((x) => ({ ...x, domain: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCompetitor();
                          }
                        }}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" icon={<Plus />} onClick={addCompetitor}>
                        Add
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  competitors.length < 20 && (
                    <Button variant="secondary" icon={<Plus />} onClick={() => setAdding(true)} fullWidth>
                      Add a competitor
                    </Button>
                  )
                )}
                </section>

                <section aria-labelledby="setup-kw-title" className="space-y-3 border-t border-border pt-5">
                  <div>
                    <h2 id="setup-kw-title" className="flex items-center gap-2 text-body font-semibold text-fg">
                      <Search size={17} aria-hidden className="text-primary" /> SEO keywords
                    </h2>
                    <p className="mt-0.5 text-small text-muted">
                      What people type into Google to find a business like yours. We ticked the most important ones — tap any
                      idea to add it, or tap again to remove it.
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {chosenKeywords.length} selected
                    </p>
                  </div>
                  {keywords.length === 0 ? (
                    <Notice tone="info">We couldn&apos;t suggest keywords this time. Add the words people search for below.</Notice>
                  ) : (
                    <ul className="flex flex-wrap gap-2" aria-label="SEO keywords">
                      {keywords.map((k, i) => (
                        <li key={k.text}>
                          <button
                            type="button"
                            aria-pressed={k.checked}
                            disabled={!k.checked && chosenKeywords.length >= MAX_KEYWORDS}
                            onClick={() => setKeywords((xs) => xs.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                            className={
                              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-small transition-colors disabled:opacity-50 " +
                              (k.checked
                                ? "border-primary bg-primary-soft font-medium text-fg"
                                : "border-dashed border-border-strong text-fg-soft hover:bg-surface-2")
                            }
                          >
                            {k.checked ? <Check size={14} aria-hidden className="text-primary" /> : <Plus size={14} aria-hidden />}
                            {k.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <Field label="Add your own keyword" htmlFor="setup-keyword" error={newKeywordErr}>
                        <Input
                          id="setup-keyword"
                          value={newKeyword}
                          placeholder={facts.city ? `e.g. bakery in ${facts.city}` : "e.g. wedding cakes"}
                          invalid={!!newKeywordErr}
                          onChange={(e) => {
                            setNewKeyword(e.target.value);
                            if (newKeywordErr) setNewKeywordErr(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addKeyword();
                            }
                          }}
                        />
                      </Field>
                    </div>
                    <Button variant="secondary" icon={<Plus />} onClick={addKeyword} className="mt-7 self-start" disabled={chosenKeywords.length >= MAX_KEYWORDS}>
                      Add
                    </Button>
                  </div>
                </section>

                <Button size="lg" fullWidth iconRight={<ArrowRight />} onClick={loadQuestions}>
                  Next
                </Button>
                <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => setScreen("facts")}>
                  Back
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {screen === "questions" && (
        <Card variant="elevated">
          <CardBody>
            <StepLabel screen="questions" />
            {loading ? (
              <Loading text={loading} />
            ) : questionsErr ? (
              <div className="space-y-5">
                <h1 id="setup-heading" tabIndex={-1} className="text-h3 text-fg outline-none">
                  Questions we&apos;ll ask AI
                </h1>
                <Notice tone="danger" title="We couldn't write your questions">
                  {questionsErr} Try again, or <ContactLink /> if it keeps happening.
                </Notice>
                <Button size="lg" fullWidth onClick={loadQuestions}>
                  Retry
                </Button>
                <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => setScreen("competitors")}>
                  Back
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h1 id="setup-heading" tabIndex={-1} className="text-h3 text-fg outline-none">
                    Questions we&apos;ll ask AI
                  </h1>
                  <p className="mt-1 text-body text-muted">
                    We&apos;ll ask {joinNames(assistants)} these questions — the way your customers ask them — and check
                    whether the answers recommend you.
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="AI assistants we ask">
                    {assistants.map((a) => (
                      <li key={a} className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-fg-soft">
                        {a}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-small text-muted">
                    None of the questions mention your business name, so you see whether AI finds you on its own. Untick any
                    that don&apos;t fit your business.
                  </p>
                  <p className="mt-2 text-small text-muted">
                    {chosenQuestions.length} of {questions.length} ticked
                    {questions.length < questionCount ? "" : ` · your plan asks up to ${questionCount} each check`}
                  </p>
                </div>
                <ul className="space-y-2">
                  {questions.map((q, i) => (
                    <li key={`${q.text}-${i}`}>
                      <label className={`${tickBox} ${q.checked ? "border-primary bg-primary-soft" : "border-border"}`}>
                        <input
                          type="checkbox"
                          className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
                          checked={q.checked}
                          onChange={(e) => {
                            setQuestions((xs) => xs.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)));
                            if (questionsTickErr) setQuestionsTickErr(null);
                          }}
                        />
                        <span className="min-w-0 break-words text-small text-fg">{q.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {questionsTickErr && (
                  <p role="alert" className="text-small text-danger">
                    {questionsTickErr}
                  </p>
                )}
                <Button size="lg" fullWidth icon={<Sparkles />} onClick={start}>
                  Start my check
                </Button>
                <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => setScreen("competitors")}>
                  Back
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {screen !== "limit" && (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <Globe size={13} aria-hidden />
          We only read public pages. Nothing changes on your site without your OK.
        </p>
      )}
    </div>
  );
}
