// Visibility measurement workflow: prompts × providers → Observations → VisibilityRun.metrics.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enqueue, type JobContext, type JobHandler } from "@/lib/jobs/queue";
import { getEngineLimit, getPlan } from "@/lib/billing/plans";
import { aiLimitMessage, getRunPromptCap, sizeRunToAllowance } from "@/lib/billing/ai-limits";
import { getAiAllowance } from "@/lib/billing/allowance";
import { isAiBudgetExhausted, nextUtcDayStart } from "@/lib/billing/ai-budget";
import { recordUsage, releaseReservation, reserveCredits } from "@/lib/billing/usage";
import { getAvailableProviders } from "@/lib/providers/visibility/registry";
import { withTimeout } from "@/lib/providers/visibility/errors";
import { isSerpProviderId } from "@/lib/providers/visibility/google-ai-overviews";
import { JobError, type ProviderAnswer, type VisibilityProvider } from "@/lib/types";
import { writeSnapshot } from "@/lib/snapshots";
import { log } from "@/lib/log";
import { computeMetrics, type MetricObservation } from "./metrics";
import { parseAnswer } from "./parse";
import { projectVisibilityContext } from "./project-context";
import { BRAND_PROBE_TASK_TYPE, brandProbePrompts, loadBrandFacts, runBrandKnowledgeProbe, type BrandKnowledgeResult } from "./brand-knowledge";

export const VISIBILITY_TASK_TYPE = "visibility_prompt";
/** Concurrent calls per provider (shared by every run in this process). Keys: full provider id, else the part before ":". */
export const PROVIDER_CONCURRENCY: Record<string, number> = { openrouter: 3, openai: 3, gemini: 3, perplexity: 2, dataforseo: 2, simulated: 5 };
export const DEFAULT_PROVIDER_CONCURRENCY = 3;
const CALL_TIMEOUT_MS = 120_000;
/** Resumed runs start a few minutes after 00:00 UTC (spread out so they don't all hit the providers at once). */
const RESUME_DELAY_MS = 5 * 60_000;
/** Simulated demo answers are free (no credits) — they are not real measurements. */
const creditsFor = (p: VisibilityProvider) => (p.simulated ? 0 : 1);
/**
 * Usage is recorded every USAGE_BATCH answers, not only at the end: provider calls are billed as they happen,
 * so a crash/restart mid-run must not lose the spend already incurred (the resumed attempt only re-runs the
 * pairs with no Observation, so nothing is counted twice).
 */
export const USAGE_BATCH = 10;

export function concurrencyFor(providerId: string, limits: Record<string, number> = PROVIDER_CONCURRENCY): number {
  const n = limits[providerId] ?? limits[providerId.split(":")[0]] ?? DEFAULT_PROVIDER_CONCURRENCY;
  return Math.max(1, Math.floor(n));
}

/**
 * Per-key concurrency limiter (a counting semaphore per provider). Every engine runs in parallel; within one
 * engine at most `limitFor(key)` calls are in flight. Exported for tests.
 */
export function createProviderLimiter(limitFor: (key: string) => number = (k) => concurrencyFor(k)) {
  const active = new Map<string, number>();
  const queues = new Map<string, (() => void)[]>();
  const acquire = (key: string) =>
    new Promise<void>((resolve) => {
      const n = active.get(key) ?? 0;
      if (n < limitFor(key)) {
        active.set(key, n + 1);
        resolve();
      } else {
        const q = queues.get(key) ?? [];
        q.push(() => {
          active.set(key, (active.get(key) ?? 0) + 1);
          resolve();
        });
        queues.set(key, q);
      }
    });
  const release = (key: string) => {
    active.set(key, Math.max(0, (active.get(key) ?? 1) - 1));
    const next = queues.get(key)?.shift();
    if (next) next();
  };
  return {
    async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
      await acquire(key);
      try {
        return await fn();
      } finally {
        release(key);
      }
    },
    /** In-flight calls for a key (tests / diagnostics). */
    active: (key: string) => active.get(key) ?? 0,
  };
}

// One limiter per process (globalThis: route bundles and the worker share it), so two runs don't double the rate.
const lg = globalThis as unknown as { __providerLimiter?: ReturnType<typeof createProviderLimiter> };
const providerLimiter = (lg.__providerLimiter ??= createProviderLimiter());

type UsageTotals = Map<string, { credits: number; costMicros: number }>;

/**
 * Accumulates per-provider usage and writes it to the ledger in batches. Flushes are serialized so
 * concurrent pool workers never record the same slice twice. Exported for tests.
 */
export function createUsageBatcher(record: (provider: string, u: { credits: number; costMicros: number }) => Promise<void>, batchSize = USAGE_BATCH) {
  let pending: UsageTotals = new Map();
  let sinceFlush = 0;
  let chain: Promise<void> = Promise.resolve();
  const flush = () => {
    const slice = pending;
    pending = new Map();
    sinceFlush = 0;
    chain = chain.then(async () => {
      for (const [provider, u] of slice) {
        if (u.credits <= 0 && u.costMicros <= 0) continue;
        try {
          await record(provider, u);
        } catch (err) {
          // Keep the spend for the next flush instead of dropping it; never fail an answer over accounting.
          const p = pending.get(provider) ?? { credits: 0, costMicros: 0 };
          pending.set(provider, { credits: p.credits + u.credits, costMicros: p.costMicros + u.costMicros });
          log.warn("visibility.usage_record_failed", { provider, err });
        }
      }
    });
    return chain;
  };
  return {
    add(provider: string, credits: number, costMicros: number) {
      const u = pending.get(provider) ?? { credits: 0, costMicros: 0 };
      pending.set(provider, { credits: u.credits + credits, costMicros: u.costMicros + costMicros });
      if (++sinceFlush >= batchSize) return flush();
      return chain;
    },
    flush,
  };
}

/**
 * A crashed earlier attempt of this run never released its credit holds. Release whatever is still held
 * (reservation − release) for this run before reserving again, so a resume doesn't double-hold credits.
 */
async function releaseOutstandingHolds(orgId: string, runId: string, taskTypes: string[]) {
  const rows = await db.usageLedger.groupBy({
    by: ["provider", "taskType", "kind"],
    where: { organizationId: orgId, runId, taskType: { in: taskTypes }, kind: { in: ["reservation", "release"] } },
    _sum: { credits: true },
  });
  const held = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.provider}|${r.taskType}`;
    held.set(key, (held.get(key) ?? 0) + (r.kind === "reservation" ? 1 : -1) * (r._sum.credits ?? 0));
  }
  for (const [key, credits] of held) {
    if (credits <= 0) continue;
    const [provider, taskType] = key.split("|");
    await releaseReservation(orgId, { provider, taskType, credits, runId });
  }
}

async function runWithRetry(provider: VisibilityProvider, q: Parameters<VisibilityProvider["run"]>[0]): Promise<ProviderAnswer> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withTimeout(provider.run(q), CALL_TIMEOUT_MS, `${provider.id} call`);
    } catch (err) {
      const transient = !(err instanceof JobError) || err.errorClass === "transient";
      if (attempt >= 1 || !transient) throw err;
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
    }
  }
}

export const visibilityJob: JobHandler = async (ctx) => {
  const visibilityRunId = String(ctx.run.input.visibilityRunId ?? "");
  const orgId = ctx.run.organizationId;
  const run = await db.visibilityRun.findFirst({ where: { id: visibilityRunId, organizationId: orgId } });
  if (!run) throw new JobError("Visibility run not found", "permanent");
  if (["succeeded", "succeeded_with_warnings", "failed", "cancelled"].includes(run.status)) {
    return { visibilityRunId, skipped: true, status: run.status };
  }
  const [project, org] = await Promise.all([
    db.project.findFirst({ where: { id: run.projectId, organizationId: orgId } }),
    db.organization.findUnique({ where: { id: orgId } }),
  ]);
  if (!project || !org) throw new JobError("Project not found", "permanent");

  const plan = getPlan(org.planId);
  const inputCap = Number(ctx.run.input.maxPrompts);
  const promptCap = Math.min(plan.maxTrackedPrompts, await getRunPromptCap(orgId), Number.isFinite(inputCap) && inputCap > 0 ? inputCap : Infinity);
  const allPrompts = await db.trackedPrompt.findMany({
    where: { organizationId: orgId, projectId: project.id, active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    // Plan cap per run (also applies to scheduled runs, which pass no maxPrompts).
    take: promptCap,
  });
  const pctx = projectVisibilityContext(project);
  const requested = (run.providers as string[] | null) ?? undefined;
  // Engines per run are capped by plan / done-for-you tier.
  const allProviders = await getAvailableProviders({ ...pctx, requested, maxProviders: getEngineLimit(org.planId, org.serviceTier) });

  const fail = async (msg: string, errorClass: "permanent" | "quota" = "permanent") => {
    await db.visibilityRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date() } });
    throw new JobError(msg, errorClass);
  };
  if (allPrompts.length === 0) await fail("No active prompts to measure");
  if (allProviders.length === 0) await fail("No visibility provider is configured or enabled");

  // Resume support: skip prompt×provider pairs already observed by an earlier attempt (or an earlier day).
  const existing = await db.observation.findMany({ where: { visibilityRunId: run.id }, select: { promptId: true, provider: true } });
  const done = new Set(existing.map((o) => `${o.promptId}|${o.provider}`));

  // Fit the check into this month's AI answers (atomically, so two checks can't both take the last answers).
  const { prompts, providers, expected } = await sizeRun(run, orgId, allPrompts, allProviders, existing.length);
  if (expected === 0) await fail(aiLimitMessage(await getAiAllowance(orgId)), "quota");
  const tasks = providers
    .flatMap((p) => prompts.map((pr) => ({ provider: p, prompt: pr })))
    .filter((t) => !done.has(`${t.prompt.id}|${t.provider.id}`));

  // Resume after a crash: drop the dead attempt's holds before reserving for the remaining work.
  if (existing.length > 0 || ctx.run.attempts > 1) await releaseOutstandingHolds(orgId, run.id, [VISIBILITY_TASK_TYPE, BRAND_PROBE_TASK_TYPE]);

  // Reserve credits per provider (1 per prompt×provider; simulated is free).
  const reserved = new Map<string, number>();
  try {
    for (const p of providers) {
      const credits = tasks.filter((t) => t.provider.id === p.id).length * creditsFor(p);
      if (credits > 0) {
        await reserveCredits(orgId, { provider: p.id, taskType: VISIBILITY_TASK_TYPE, credits, runId: run.id, projectId: project.id });
        reserved.set(p.id, credits);
      }
    }
  } catch (err) {
    for (const [provider, credits] of reserved) await releaseReservation(orgId, { provider, taskType: VISIBILITY_TASK_TYPE, credits, runId: run.id });
    const msg = err instanceof Error ? err.message : "Credit reservation failed";
    await fail(msg, "quota");
  }

  await db.visibilityRun.update({
    where: { id: run.id },
    data: { status: "running", startedAt: run.startedAt ?? new Date() },
  });
  await ctx.transition("running", "visibility_run.started", {
    prompts: prompts.length,
    providers: providers.map((p) => p.id),
    expected,
    remaining: tasks.length,
  });

  const usage = createUsageBatcher((provider, u) =>
    recordUsage(orgId, { provider, taskType: VISIBILITY_TASK_TYPE, credits: u.credits, costMicros: u.costMicros, runId: run.id, projectId: project.id }),
  );
  const failures: MetricObservation[] = [];
  const errorsByProvider: Record<string, string> = {};
  // Set when today's AI budget runs out: the rest of the questions wait for tomorrow (not counted as failed).
  let deferred = false;

  try {
    // Every engine in parallel; each provider limited to its own number of concurrent calls.
    await Promise.all(
      tasks.map(({ provider, prompt }) =>
        providerLimiter.run(provider.id, async () => {
          if (ctx.signal?.aborted || deferred) return; // timed out / shutting down / budget used: no new paid calls
          try {
            const answer = await runWithRetry(provider, { promptId: prompt.id, text: prompt.text, locale: prompt.locale });
            const parsed = parseAnswer(answer, pctx);
            await db.observation.create({
              data: {
                organizationId: orgId,
                visibilityRunId: run.id,
                promptId: prompt.id,
                provider: answer.provider,
                platformLabel: answer.platformLabel,
                model: answer.model,
                locale: prompt.locale,
                rawResponse: answer.answerText.slice(0, 100_000),
                rawPayloadRef: answer.rawPayloadRef,
                citations: parsed.citations as unknown as Prisma.InputJsonValue,
                brandMentioned: parsed.brandMentioned,
                brandRecommended: parsed.brandRecommended,
                brandCited: parsed.brandCited,
                competitorMentions: parsed.competitorMentions as Prisma.InputJsonValue,
                sentiment: parsed.sentiment,
                parseConfidence: parsed.parseConfidence,
                limitations: answer.limitations,
                costMicros: answer.costMicros,
                simulated: answer.simulated,
              },
            });
            await db.visibilityRun.update({
              where: { id: run.id },
              data: { collected: { increment: 1 }, costMicros: { increment: answer.costMicros } },
            });
            await usage.add(provider.id, creditsFor(provider), answer.costMicros);
          } catch (err) {
            if (isAiBudgetExhausted(err)) {
              deferred = true;
              return;
            }
            failures.push({ provider: provider.id, brandMentioned: false, brandCited: false, brandRecommended: false, simulated: provider.simulated, ok: false });
            errorsByProvider[provider.id] = err instanceof Error ? err.message.slice(0, 300) : "unknown error";
            await db.visibilityRun.update({ where: { id: run.id }, data: { failed: { increment: 1 } } });
          }
        }),
      ),
    );
  } finally {
    // Settle usage even on abort/crash: record the remaining actuals, then release the WHOLE hold
    // (billing contract: reserve → recordUsage(actual) → release; usage isn't netted against reservations).
    await usage.flush();
    for (const p of providers) {
      const held = reserved.get(p.id) ?? 0;
      if (held > 0) await releaseReservation(orgId, { provider: p.id, taskType: VISIBILITY_TASK_TYPE, credits: held, runId: run.id });
    }
  }
  if (ctx.signal?.aborted) throw new JobError("Visibility run aborted (timeout or shutdown); collected answers are kept", "transient");
  if (deferred) return deferToTomorrow(ctx, { runId: run.id, projectId: project.id, orgId, expected, prompts: prompts.length });

  const rows = await db.observation.findMany({
    where: { visibilityRunId: run.id },
    // Metrics only need these columns; rawResponse (up to 100 KB each) stays in the DB.
    select: { provider: true, brandMentioned: true, brandCited: true, brandRecommended: true, competitorMentions: true, citations: true, simulated: true },
  });
  const finishedAt = new Date();
  const metrics = computeMetrics(
    [
      ...rows.map((r) => ({
        provider: r.provider,
        brandMentioned: r.brandMentioned,
        brandCited: r.brandCited,
        brandRecommended: r.brandRecommended,
        competitorMentions: (r.competitorMentions as Record<string, number> | null) ?? {},
        citations: (r.citations as MetricObservation["citations"]) ?? [],
        simulated: r.simulated,
      })),
      ...failures,
    ],
    { from: run.startedAt ?? run.createdAt, to: finishedAt, brandLabel: pctx.brandNames[0] },
  );

  const status = rows.length === 0 ? "failed" : failures.length > 0 ? "succeeded_with_warnings" : "succeeded";

  // Brand knowledge probe (GEO signal) — real providers only; failures never fail the run.
  let brandKnowledge: BrandKnowledgeResult[] | undefined;
  // SERP engines (Google AI Overviews / AI Mode) answer searches, not "what do you know about X" questions: not probed.
  const realProviders = providers.filter((p) => !p.simulated && !isSerpProviderId(p.id));
  if (status !== "failed" && realProviders.length > 0) {
    brandKnowledge = await runBrandProbeStep(ctx, {
      orgId,
      runId: run.id,
      project,
      providers: realProviders,
      websiteDomain: pctx.websiteDomain,
      brand: pctx.brandNames[0],
      locale: prompts[0]?.locale ?? "en",
    });
  }

  await db.visibilityRun.update({
    where: { id: run.id },
    data: {
      status,
      metrics: (brandKnowledge ? { ...metrics, brandKnowledge } : metrics) as unknown as Prisma.InputJsonValue,
      finishedAt,
    },
  });

  if (status === "failed") {
    await ctx.event("visibility_run.failed", { errors: errorsByProvider });
    throw new JobError("All provider calls failed", "permanent");
  }

  await ctx.event("visibility_run.completed", {
    visibilityRunId: run.id,
    // "123 of 125 answers": collected vs expected (run.sampleSize).
    collected: rows.length,
    expected,
    failed: failures.length,
    visibilityIndex: metrics.visibilityIndex,
    simulated: metrics.simulated,
    ...(failures.length ? { errors: errorsByProvider } : {}),
  });
  if (status === "succeeded_with_warnings") await ctx.transition("succeeded_with_warnings", "visibility_run.partial", { failed: failures.length });
  // Measurement history; writeSnapshot never throws.
  await writeSnapshot({ organizationId: orgId, projectId: project.id, kind: "visibility", visibilityRunId: run.id }).catch(() => undefined);
  await import("@/lib/alerts/hooks").then((m) => m.alertsAfterVisibility({ organizationId: orgId, projectId: project.id, visibilityRunId: run.id })).catch(() => undefined); // customer alerts; never fails the run

  await enqueue({
    kind: "analyze",
    organizationId: orgId,
    projectId: project.id,
    input: { trigger: "visibility", visibilityRunId: run.id },
    idempotencyKey: `analyze:vis:${run.id}`,
  });

  return { visibilityRunId: run.id, collected: rows.length, expected, failed: failures.length, visibilityIndex: metrics.visibilityIndex };
};

type PromptRow = Awaited<ReturnType<typeof db.trackedPrompt.findMany>>[number];

/**
 * Decide how many questions × engines this run asks and save it on the run (sampleSize = answers expected,
 * providers = engine ids). A fresh run is fitted into the AI answers left this month; a resumed run keeps the
 * size it started with. Runs under a per-organization advisory lock so concurrent checks can't over-allocate.
 */
async function sizeRun(
  run: { id: string; sampleSize: number; providers: unknown },
  orgId: string,
  allPrompts: PromptRow[],
  allProviders: VisibilityProvider[],
  existingAnswers: number,
): Promise<{ prompts: PromptRow[]; providers: VisibilityProvider[]; expected: number }> {
  return db.$transaction(async (tx) => {
    if (typeof tx.$executeRaw === "function") await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-answers:${orgId}`}))`;
    const resumed = run.sampleSize > 0 && existingAnswers > 0;
    let fit: { questions: number; engines: number };
    if (resumed) {
      // Keep the original plan: sampleSize = questions × engines, and the saved engine ids are what was requested.
      const savedEngines = Array.isArray(run.providers) ? run.providers.length : allProviders.length;
      fit = { questions: Math.min(allPrompts.length, Math.ceil(run.sampleSize / Math.max(1, savedEngines))), engines: allProviders.length };
    } else {
      const left = (await getAiAllowance(orgId, { excludeRunId: run.id })).left;
      fit = sizeRunToAllowance(left, allPrompts.length, allProviders.length);
    }
    const prompts = allPrompts.slice(0, fit.questions);
    const providers = allProviders.slice(0, fit.engines);
    const expected = resumed ? run.sampleSize : prompts.length * providers.length;
    await tx.visibilityRun.update({
      where: { id: run.id },
      data: { sampleSize: expected, providers: providers.map((p) => p.id) as Prisma.InputJsonValue },
    });
    return { prompts, providers, expected };
  });
}

/**
 * Today's AI budget ran out mid-check: keep the answers collected so far, put the run back in the queue for
 * just after 00:00 UTC (it resumes with the questions not yet answered) and tell the customer plainly.
 */
async function deferToTomorrow(
  ctx: JobContext,
  o: { runId: string; projectId: string; orgId: string; expected: number; prompts: number },
): Promise<Record<string, unknown>> {
  const now = new Date();
  const resumeAt = new Date(nextUtcDayStart(now).getTime() + RESUME_DELAY_MS + Math.floor(Math.random() * RESUME_DELAY_MS));
  const day = resumeAt.toISOString().slice(0, 10);
  const current = await db.visibilityRun.findUnique({ where: { id: o.runId }, select: { collected: true } });
  const collected = current?.collected ?? 0;
  const wf = await enqueue({
    kind: "visibility",
    organizationId: o.orgId,
    projectId: o.projectId,
    input: { ...ctx.run.input, visibilityRunId: o.runId, maxPrompts: o.prompts, resumedFrom: ctx.run.id },
    idempotencyKey: `visibility:${o.runId}:resume:${day}`,
    runAfter: resumeAt,
  });
  // Still in flight (holds its expected answers); point it at the new workflow so recovery doesn't fail it.
  await db.visibilityRun.update({ where: { id: o.runId }, data: { status: "queued", workflowRunId: wf.id } });
  await ctx.event("visibility_run.deferred", { reason: "daily_ai_budget", collected, expected: o.expected, resumeAt: resumeAt.toISOString() });
  const link = `/app/projects/${o.projectId}/visibility?run=${o.runId}&waiting=${day}`;
  const already = await db.notification.findFirst({ where: { organizationId: o.orgId, type: "visibility_deferred", link }, select: { id: true } });
  if (!already) {
    await db.notification.create({
      data: {
        organizationId: o.orgId,
        type: "visibility_deferred",
        title: "We'll finish the rest of your AI check tomorrow",
        body: `We collected ${collected} of ${o.expected} AI answers today. We'll collect the rest automatically tomorrow — there's nothing you need to do.`,
        link,
      },
    });
  }
  return { visibilityRunId: o.runId, deferred: true, collected, expected: o.expected, resumeAt: resumeAt.toISOString() };
}

async function runBrandProbeStep(
  ctx: JobContext,
  o: {
    orgId: string;
    runId: string;
    project: Parameters<typeof loadBrandFacts>[0];
    providers: VisibilityProvider[];
    websiteDomain: string;
    brand: string | undefined;
    locale: string;
  },
): Promise<BrandKnowledgeResult[] | undefined> {
  if (!o.brand) return undefined;
  const perProvider = brandProbePrompts(o.brand).length;
  const reserved = new Map<string, number>();
  try {
    for (const p of o.providers) {
      await reserveCredits(o.orgId, { provider: p.id, taskType: BRAND_PROBE_TASK_TYPE, credits: perProvider, runId: o.runId, projectId: o.project.id });
      reserved.set(p.id, perProvider);
    }
  } catch {
    // Out of credits: skip the optional probe rather than failing the measured run.
    for (const [provider, credits] of reserved) await releaseReservation(o.orgId, { provider, taskType: BRAND_PROBE_TASK_TYPE, credits, runId: o.runId });
    await ctx.event("brand_probe.skipped", { reason: "quota" });
    return undefined;
  }
  try {
    const facts = await loadBrandFacts(o.project, o.websiteDomain);
    const outcome = await runBrandKnowledgeProbe({ providers: o.providers, facts, locale: o.locale, runner: runWithRetry });
    let probeCost = outcome.assessmentCostMicros;
    for (const [provider, u] of Object.entries(outcome.usage)) {
      probeCost += u.costMicros;
      await recordUsage(o.orgId, { provider, taskType: BRAND_PROBE_TASK_TYPE, credits: u.calls, costMicros: u.costMicros, runId: o.runId, projectId: o.project.id });
    }
    if (outcome.assessmentCostMicros > 0) {
      await recordUsage(o.orgId, { provider: "llm", taskType: BRAND_PROBE_TASK_TYPE, credits: 0, costMicros: outcome.assessmentCostMicros, runId: o.runId, projectId: o.project.id });
    }
    if (probeCost > 0) await db.visibilityRun.update({ where: { id: o.runId }, data: { costMicros: { increment: probeCost } } });
    await ctx.event("brand_probe.completed", {
      providers: outcome.results.map((r) => ({ provider: r.provider, knowsBrand: r.knowsBrand, method: r.method })),
      ...(Object.keys(outcome.errors).length ? { errors: outcome.errors } : {}),
    });
    return outcome.results.length ? outcome.results : undefined;
  } catch (err) {
    await ctx.event("brand_probe.failed", { error: err instanceof Error ? err.message.slice(0, 300) : "unknown error" });
    return undefined;
  } finally {
    for (const [provider, credits] of reserved) await releaseReservation(o.orgId, { provider, taskType: BRAND_PROBE_TASK_TYPE, credits, runId: o.runId });
  }
}
