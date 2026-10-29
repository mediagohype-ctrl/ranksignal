// Visibility measurement workflow: prompts × providers → Observations → VisibilityRun.metrics.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enqueue, type JobContext, type JobHandler } from "@/lib/jobs/queue";
import { getEngineLimit, getPlan } from "@/lib/billing/plans";
import { getRunPromptCap } from "@/lib/billing/ai-limits";
import { recordUsage, releaseReservation, reserveCredits } from "@/lib/billing/usage";
import { getAvailableProviders } from "@/lib/providers/visibility/registry";
import { withTimeout } from "@/lib/providers/visibility/errors";
import { JobError, type ProviderAnswer, type VisibilityProvider } from "@/lib/types";
import { writeSnapshot } from "@/lib/snapshots";
import { log } from "@/lib/log";
import { computeMetrics, type MetricObservation } from "./metrics";
import { parseAnswer } from "./parse";
import { projectVisibilityContext } from "./project-context";
import { BRAND_PROBE_TASK_TYPE, brandProbePrompts, loadBrandFacts, runBrandKnowledgeProbe, type BrandKnowledgeResult } from "./brand-knowledge";

export const VISIBILITY_TASK_TYPE = "visibility_prompt";
const CONCURRENCY = 3;
const CALL_TIMEOUT_MS = 120_000;
/** Simulated demo answers are free (no credits) — they are not real measurements. */
const creditsFor = (p: VisibilityProvider) => (p.simulated ? 0 : 1);
/**
 * Usage is recorded every USAGE_BATCH answers, not only at the end: provider calls are billed as they happen,
 * so a crash/restart mid-run must not lose the spend already incurred (the resumed attempt only re-runs the
 * pairs with no Observation, so nothing is counted twice).
 */
export const USAGE_BATCH = 10;

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

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
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
  const prompts = await db.trackedPrompt.findMany({
    where: { organizationId: orgId, projectId: project.id, active: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    // Plan cap per run (also applies to scheduled runs, which pass no maxPrompts).
    take: Math.min(plan.maxTrackedPrompts, await getRunPromptCap(orgId)),
  });
  const pctx = projectVisibilityContext(project);
  const requested = (run.providers as string[] | null) ?? undefined;
  // Engines per run are capped by plan / done-for-you tier.
  const providers = await getAvailableProviders({ ...pctx, requested, maxProviders: getEngineLimit(org.planId, org.serviceTier) });

  const fail = async (msg: string, errorClass: "permanent" | "quota" = "permanent") => {
    await db.visibilityRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date() } });
    throw new JobError(msg, errorClass);
  };
  if (prompts.length === 0) await fail("No active prompts to measure");
  if (providers.length === 0) await fail("No visibility provider is configured or enabled");

  // Resume support: skip prompt×provider pairs already observed by an earlier attempt.
  const existing = await db.observation.findMany({ where: { visibilityRunId: run.id }, select: { promptId: true, provider: true } });
  const done = new Set(existing.map((o) => `${o.promptId}|${o.provider}`));
  const tasks = providers.flatMap((p) => prompts.map((pr) => ({ provider: p, prompt: pr }))).filter((t) => !done.has(`${t.prompt.id}|${t.provider.id}`));

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
    data: {
      status: "running",
      startedAt: run.startedAt ?? new Date(),
      sampleSize: providers.length * prompts.length,
      providers: providers.map((p) => p.id) as Prisma.InputJsonValue,
    },
  });
  await ctx.transition("running", "visibility_run.started", { prompts: prompts.length, providers: providers.map((p) => p.id) });

  const usage = createUsageBatcher((provider, u) =>
    recordUsage(orgId, { provider, taskType: VISIBILITY_TASK_TYPE, credits: u.credits, costMicros: u.costMicros, runId: run.id, projectId: project.id }),
  );
  const failures: MetricObservation[] = [];
  const errorsByProvider: Record<string, string> = {};

  try {
    await pool(tasks, CONCURRENCY, async ({ provider, prompt }) => {
      if (ctx.signal?.aborted) return; // timed out / shutting down: stop starting new paid calls
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
        failures.push({ provider: provider.id, brandMentioned: false, brandCited: false, brandRecommended: false, simulated: provider.simulated, ok: false });
        errorsByProvider[provider.id] = err instanceof Error ? err.message.slice(0, 300) : "unknown error";
        await db.visibilityRun.update({ where: { id: run.id }, data: { failed: { increment: 1 } } });
      }
    });
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
  const realProviders = providers.filter((p) => !p.simulated);
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
    collected: rows.length,
    failed: failures.length,
    visibilityIndex: metrics.visibilityIndex,
    simulated: metrics.simulated,
    ...(failures.length ? { errors: errorsByProvider } : {}),
  });
  if (status === "succeeded_with_warnings") await ctx.transition("succeeded_with_warnings", "visibility_run.partial", { failed: failures.length });
  // Measurement history; writeSnapshot never throws.
  await writeSnapshot({ organizationId: orgId, projectId: project.id, kind: "visibility", visibilityRunId: run.id }).catch(() => undefined);

  await enqueue({
    kind: "analyze",
    organizationId: orgId,
    projectId: project.id,
    input: { trigger: "visibility", visibilityRunId: run.id },
    idempotencyKey: `analyze:vis:${run.id}`,
  });

  return { visibilityRunId: run.id, collected: rows.length, failed: failures.length, visibilityIndex: metrics.visibilityIndex };
};

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
