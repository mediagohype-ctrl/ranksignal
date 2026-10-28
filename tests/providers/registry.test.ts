import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flags = new Map<string, boolean>();
vi.mock("@/lib/db", () => ({
  db: {
    featureFlag: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => (flags.has(where.key) ? { key: where.key, enabled: flags.get(where.key) } : null)),
    },
  },
}));

import { describeProviders, getAvailableProviders } from "@/lib/providers/visibility/registry";

const ctx = { brandNames: ["Acme"], competitors: [], websiteDomain: "acme.in" };
const KEYS = ["OPENAI_API_KEY", "GEMINI_API_KEY", "PERPLEXITY_API_KEY", "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"];

beforeEach(() => {
  flags.clear();
  for (const k of KEYS) vi.stubEnv(k, "");
  vi.stubEnv("ALLOW_SIMULATED_PROVIDER", "true");
});
afterEach(() => vi.unstubAllEnvs());

const ids = async (requested?: string[]) => (await getAvailableProviders({ ...ctx, requested })).map((p) => p.id);

describe("visibility provider registry", () => {
  it("no keys → simulated only", async () => {
    expect(await ids()).toEqual(["simulated"]);
    const d = await describeProviders();
    expect(d.mode).toBe("simulated");
    expect(d.providers.find((p) => p.id === "simulated")?.active).toBe(true);
  });

  it("no keys and simulated disallowed → nothing", async () => {
    vi.stubEnv("ALLOW_SIMULATED_PROVIDER", "false");
    expect(await ids()).toEqual([]);
    expect((await describeProviders()).mode).toBe("none");
  });

  it("a real key → that provider, never simulated (even if requested)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g");
    expect(await ids()).toEqual(["gemini"]);
    expect(await ids(["simulated"])).toEqual(["gemini"]);
    const d = await describeProviders();
    expect(d.mode).toBe("real");
    expect(d.providers.find((p) => p.id === "simulated")?.active).toBe(false);
    expect(JSON.stringify(d)).not.toContain('"g"');
  });

  it("uses every configured real provider; absent flags mean enabled", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("PERPLEXITY_API_KEY", "p");
    vi.stubEnv("OPENAI_API_KEY", "o");
    expect(await ids()).toEqual(["openai", "gemini", "perplexity"]);
    expect(await ids(["perplexity"])).toEqual(["perplexity"]);
  });

  it("honours provider.<id> kill switches", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("PERPLEXITY_API_KEY", "p");
    flags.set("provider.gemini", false);
    expect(await ids()).toEqual(["perplexity"]);
    flags.set("provider.perplexity", false);
    // All real providers disabled → treated as none configured → simulated fallback.
    expect(await ids()).toEqual(["simulated"]);
    flags.set("provider.simulated", false);
    expect(await ids()).toEqual([]);
  });

  it("OpenAI visibility needs OPENAI_API_KEY specifically (a Gemini key doesn't enable it)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "g");
    expect(await ids(["openai"])).toEqual(["gemini"]);
  });
});
