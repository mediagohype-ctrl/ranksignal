// Visibility provider registry. Uses EVERY configured + enabled real provider (OpenRouter models, OpenAI, Gemini, Perplexity,
// DataForSEO). The simulated provider (clearly labelled fake data) is used ONLY when no real provider is
// configured, the "provider.simulated" flag is ON (default OFF), ALLOW_SIMULATED_PROVIDER !== "false", and never
// in production (NODE_ENV=production).
import { db } from "@/lib/db";
import { FLAG_DEFAULTS } from "@/lib/flags";
import type { VisibilityProvider } from "@/lib/types";
import { openaiVisibilityProvider } from "./openai";
import { geminiVisibilityProvider } from "./gemini";
import { perplexityVisibilityProvider } from "./perplexity";
import { dataForSeoVisibilityProvider } from "./dataforseo";
import { googleAiModeProvider, googleAiOverviewsProvider } from "./google-ai-overviews";
import { getOpenRouterProviders } from "./openrouter";
import { createSimulatedProvider, SIMULATED_LABEL, type SimulatedContext } from "./simulated";

export interface ProjectProviderContext extends SimulatedContext {
  /** Explicit provider ids to use (e.g. ["gemini"]); otherwise every configured real provider. */
  requested?: string[];
  /** Plan cap on AI engines per run (see getEngineLimit); providers are taken in configured priority order. */
  maxProviders?: number;
}

const DIRECT_PROVIDERS: VisibilityProvider[] = [
  openaiVisibilityProvider,
  geminiVisibilityProvider,
  perplexityVisibilityProvider,
  dataForSeoVisibilityProvider,
  // Google AI Overviews / AI Mode (DataForSEO SERP API) last, so plans with fewer engines per check keep the chat assistants first.
  googleAiOverviewsProvider,
  googleAiModeProvider,
];

/** Every real provider: direct APIs plus one OpenRouter provider per configured model (read from env at call time). */
export function realProviders(): VisibilityProvider[] {
  return [...getOpenRouterProviders(), ...DIRECT_PROVIDERS];
}

/** Env vars each provider needs (names only — never values). */
export const PROVIDER_ENV: Record<string, string[]> = {
  openai: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"],
  dataforseo: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
  google_aio: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
  google_ai_mode: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
  openrouter: ["OPENROUTER_API_KEY", "OPENROUTER_VISIBILITY_MODELS"],
};

/**
 * provider.<id> kill switches: an explicit FeatureFlag row wins; an absent row means the flags.ts default, else
 * ENABLED (so new real providers don't need a default). DB errors fail open to enabled for real providers only,
 * because configuration via env is itself an explicit opt-in; simulated fails closed.
 */
export async function isProviderEnabled(id: string): Promise<boolean> {
  try {
    const flag = await db.featureFlag.findUnique({ where: { key: `provider.${id}` } });
    return flag ? flag.enabled : (FLAG_DEFAULTS[`provider.${id}`] ?? true);
  } catch {
    return id !== "simulated";
  }
}

/** Environment allows made-up demo answers at all: never in production, and ALLOW_SIMULATED_PROVIDER=false turns it off. */
export function simulatedAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_SIMULATED_PROVIDER !== "false";
}

/** Every provider id a run may request: real providers (incl. one per configured OpenRouter model) + "simulated". */
export function knownProviderIds(): string[] {
  return [...realProviders().map((p) => p.id), "simulated"];
}

/** A requested id is valid when it is a registry id or any OpenRouter model id ("openrouter:<vendor>/<model>"). */
export function isKnownProviderId(id: string): boolean {
  return knownProviderIds().includes(id) || /^openrouter:[\w.-]+\/[\w.:-]+$/.test(id);
}

/** Real providers that are configured (env) and enabled (flag). */
export async function getConfiguredRealProviders(): Promise<VisibilityProvider[]> {
  const out: VisibilityProvider[] = [];
  for (const p of realProviders()) if (p.isConfigured() && (await isProviderEnabled(p.id))) out.push(p);
  return out;
}

export async function getAvailableProviders(ctx: ProjectProviderContext): Promise<VisibilityProvider[]> {
  const configured = await getConfiguredRealProviders();
  const requested = ctx.requested?.length ? new Set(ctx.requested) : null;
  if (configured.length > 0) {
    // Real data available: never mix in simulated answers.
    const picked = requested ? configured.filter((p) => requested.has(p.id)) : configured;
    // A stale request (e.g. ["simulated"] saved before keys were added) falls back to all real providers.
    const chosen = picked.length > 0 ? picked : configured;
    return ctx.maxProviders && ctx.maxProviders > 0 ? chosen.slice(0, ctx.maxProviders) : chosen;
  }
  const wantsSimulated = !requested || requested.has("simulated");
  if (wantsSimulated && simulatedAllowed() && (await isProviderEnabled("simulated"))) return [createSimulatedProvider(ctx)];
  return [];
}

export interface ProviderDescription {
  id: string;
  label: string;
  configured: boolean;
  enabled: boolean;
  /** Will be used by the next visibility run. */
  active: boolean;
  simulated: boolean;
  envVars: string[];
}

/**
 * Provider availability for UI/settings (no secrets). With `maxProviders` (the plan's engines per check), only the
 * first N configured + enabled engines are `active` — exactly the ones the next AI check will ask.
 */
export async function describeProviders(o: { maxProviders?: number } = {}): Promise<{ providers: ProviderDescription[]; mode: "real" | "simulated" | "none" }> {
  const providers: ProviderDescription[] = [];
  let used = 0;
  for (const p of realProviders()) {
    const configured = p.isConfigured();
    const enabled = await isProviderEnabled(p.id);
    const usable = configured && enabled && (!o.maxProviders || o.maxProviders <= 0 || used < o.maxProviders);
    if (usable) used++;
    providers.push({ id: p.id, label: p.label, configured, enabled, active: usable, simulated: false, envVars: PROVIDER_ENV[p.id.split(":")[0]] ?? [] });
  }
  const anyReal = providers.some((p) => p.active);
  const simEnabled = await isProviderEnabled("simulated");
  const simActive = !anyReal && simulatedAllowed() && simEnabled;
  providers.push({
    id: "simulated",
    label: SIMULATED_LABEL,
    configured: simulatedAllowed(),
    enabled: simEnabled,
    active: simActive,
    simulated: true,
    envVars: ["ALLOW_SIMULATED_PROVIDER"],
  });
  return { providers, mode: anyReal ? "real" : simActive ? "simulated" : "none" };
}
