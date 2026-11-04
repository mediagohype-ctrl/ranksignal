"use client";
// Progress screen after "Start my check": Reading your site → Asking AI → Making your plan.
// Opens Home as soon as the WEBSITE results are ready; the AI check keeps running and Home refreshes itself.
// Never says the report is ready before AI answers are in.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import { api, ApiClientError, errorMessage } from "@/lib/dashboard/client";
import { BRAND } from "@/lib/brand";
import type { BusinessFacts } from "@/lib/setup/facts";
import { Button, Card, CardBody, CardHeader, LinkButton, Notice, ProgressSteps, type ProgressStep, type StepStatus } from "@/components/ui";

export interface SetupProjectPayload {
  name: string;
  websiteUrl: string;
  brandNames: string[];
  categories: string[];
  audience?: string;
  countries: string[];
  languages: string[];
  competitors: { name: string; domain?: string; aliases: string[] }[];
  keywords: string[];
  facts: BusinessFacts;
}

interface DashboardPoll {
  item: {
    recentRuns: { id: string; kind: "crawl" | "visibility"; status: string; progress: { done: number; total: number }; error?: string | null }[];
  };
}

type Kick = { state: "pending" | "running" | "done" | "error"; error?: string };
const DONE = ["succeeded", "succeeded_with_warnings"];
const FAILED = ["failed", "cancelled", "canceled", "rollback_failed"];

const pages = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;
const answers = (n: number) => `${n} ${n === 1 ? "answer" : "answers"}`;

export function SetupProgress({
  host,
  project,
  questions,
  onEdit,
}: {
  host: string;
  project: SetupProjectPayload;
  questions: { text: string; intent?: string; topic?: string; locale?: string }[];
  onEdit: () => void;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [kick, setKick] = useState<Record<"prompts" | "crawl" | "visibility", Kick>>({
    prompts: { state: "pending" },
    crawl: { state: "pending" },
    visibility: { state: "pending" },
  });
  const [poll, setPoll] = useState<DashboardPoll["item"] | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const busy = useRef(false);
  const started = useRef(false);
  const kickRef = useRef(kick);
  kickRef.current = kick;
  const idRef = useRef<string | null>(null);

  const run = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    setCreateError(null);
    const setK = (k: keyof typeof kick, v: Kick) => setKick((x) => ({ ...x, [k]: v }));

    let id = idRef.current;
    if (!id) {
      try {
        const r = await api<{ item: { id: string } }>("/api/projects", { body: project });
        id = r.item.id;
        idRef.current = id;
        setProjectId(id);
      } catch (e) {
        setCreateError(errorMessage(e));
        busy.current = false;
        setRunning(false);
        return;
      }
    }
    const cur = kickRef.current;

    let promptsOk = cur.prompts.state === "done";
    if (!promptsOk) {
      setK("prompts", { state: "running" });
      try {
        await api(`/api/projects/${id}/prompts`, { body: { prompts: questions } });
        promptsOk = true;
      } catch (e) {
        // 409 = they were already saved by an earlier try.
        promptsOk = e instanceof ApiClientError && e.status === 409;
        if (!promptsOk) setK("prompts", { state: "error", error: errorMessage(e) });
      }
      if (promptsOk) setK("prompts", { state: "done" });
    }

    if (cur.crawl.state !== "done") {
      setK("crawl", { state: "running" });
      try {
        await api(`/api/projects/${id}/crawl-runs`, { body: {} });
        setK("crawl", { state: "done" });
      } catch (e) {
        setK("crawl", { state: "error", error: errorMessage(e) });
      }
    }

    if (cur.visibility.state !== "done" && promptsOk) {
      setK("visibility", { state: "running" });
      try {
        await api(`/api/projects/${id}/visibility-runs`, { body: {} });
        setK("visibility", { state: "done" });
      } catch (e) {
        setK("visibility", { state: "error", error: errorMessage(e) });
      }
    }
    busy.current = false;
    setRunning(false);
  }, [project, questions]);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev: start once
    started.current = true;
    void run();
  }, [run]);

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
    void load();
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
  const settled = (["prompts", "crawl", "visibility"] as const).every((k) => kick[k].state === "done" || kick[k].state === "error" || (k === "visibility" && kick.prompts.state === "error"));
  const homeHref = projectId ? `/app/projects/${projectId}` : "/app";

  useEffect(() => {
    if (!projectId || ready || !crawlDone || !settled) return;
    setReady(true);
    const t = setTimeout(() => {
      router.push(`/app/projects/${projectId}`);
      router.refresh();
    }, 1500);
    return () => clearTimeout(t);
  }, [crawlDone, settled, projectId, ready, router]);

  /* ---------------- steps */

  const readStatus: StepStatus = createError || crawlFailed ? "error" : crawlDone ? "done" : "active";
  const readDesc = createError
    ? "We couldn't save your website."
    : kick.crawl.error
      ? kick.crawl.error
      : crawlFailed
        ? "We couldn't finish reading your site."
        : crawlRun && crawlRun.progress.total > 0
          ? `${pages(crawlRun.progress.done)} of ${crawlRun.progress.total} read`
          : crawlDone
            ? "Done"
            : "Opening your public pages…";

  const visDone = !!visRun && DONE.includes(visRun.status);
  const visFailed = kick.prompts.state === "error" || kick.visibility.state === "error" || (!!visRun && FAILED.includes(visRun.status));
  const askStatus: StepStatus = visFailed ? "error" : visDone ? "done" : kick.visibility.state === "pending" && !visRun ? "pending" : "active";
  const askDesc =
    kick.prompts.error ??
    kick.visibility.error ??
    (visFailed
      ? "The AI check didn't finish. You can run it again from Home."
      : visDone
        ? "Done"
        : visRun && visRun.progress.total > 0
          ? `${answers(visRun.progress.done)} of ${visRun.progress.total} in — this keeps going after Home opens`
          : "Asking ChatGPT, Gemini and others your customers' questions…");

  const planStatus: StepStatus = ready ? "done" : crawlDone ? "active" : "pending";
  const planDesc = ready ? "Opening Home…" : crawlDone ? "Turning what we found into a plain to-do list…" : "Starts when we've read your site";

  const steps: ProgressStep[] = [
    { id: "read", label: "Reading your site", description: readDesc, status: readStatus },
    { id: "ask", label: "Asking AI", description: askDesc, status: askStatus },
    { id: "plan", label: "Making your plan", description: planDesc, status: planStatus },
  ];

  const canRetry = !running && (!!createError || kick.crawl.state === "error" || kick.prompts.state === "error" || kick.visibility.state === "error");

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card variant="elevated">
        <CardHeader
          icon={<Rocket />}
          eyebrow={ready ? "Done" : "Setting up"}
          title={ready ? "Your website results are ready" : `Checking ${host || "your website"}`}
          description={
            ready
              ? "AI answers are still coming in. Home updates by itself."
              : "This takes a few minutes. You can leave this page — we'll keep going."
          }
        />
        <CardBody className="space-y-5">
          <div aria-live="polite">
            <ProgressSteps label="Setup progress" steps={steps} />
          </div>

          {createError && (
            <Notice tone="danger" title="We couldn't save your website">
              {createError}
            </Notice>
          )}
          {!createError && (crawlFailed || kick.prompts.state === "error" || kick.visibility.state === "error") && (
            <Notice tone="warning">
              Something didn&apos;t start. Try again, or{" "}
              <a className="font-medium text-primary hover:underline" href={`mailto:${BRAND.supportEmail}`}>
                contact us
              </a>
              .
            </Notice>
          )}

          <div className="flex flex-col gap-2">
            {ready ? (
              <LinkButton href={homeHref} size="lg" fullWidth iconRight={<ArrowRight />}>
                Open Home
              </LinkButton>
            ) : canRetry ? (
              <Button size="lg" fullWidth onClick={() => void run()}>
                Retry
              </Button>
            ) : null}
            {createError && !running && (
              <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onEdit}>
                Change my answers
              </Button>
            )}
            {!ready && projectId && crawlFailed && !running && (
              <LinkButton href={homeHref} variant="ghost" size="sm">
                Open Home anyway
              </LinkButton>
            )}
          </div>

          <p className="text-xs text-muted">
            We check your public pages and a sample of AI answers. It shows where you stand today — nobody can promise a place on Google or in AI answers.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
