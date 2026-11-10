import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flags = new Map<string, boolean>();
vi.mock("@/lib/db", () => ({
  db: { featureFlag: { findUnique: vi.fn(async ({ where }: { where: { key: string } }) => (flags.has(where.key) ? { key: where.key, enabled: flags.get(where.key) } : null)) } },
}));
const budget = vi.hoisted(() => ({ settled: [] as number[], released: 0 }));
vi.mock("@/lib/billing/ai-budget", () => ({
  reserveAiSpend: vi.fn(async () => ({ settle: (c: number) => budget.settled.push(c), release: () => budget.released++ })),
}));

import {
  googleAiModeProvider, googleAiOverviewsProvider, isSerpProviderId, NO_AI_OVERVIEW_TEXT, parseAiOverviewPayload, serpKeyword, serpLocation,
} from "@/lib/providers/visibility/google-ai-overviews";
import { describeProviders, getAvailableProviders } from "@/lib/providers/visibility/registry";
import { parseAnswer } from "@/lib/visibility/parse";
import { computeMetrics } from "@/lib/visibility/metrics";
import { engineName } from "@/components/app/providers-status";

const aio = {
  type: "ai_overview",
  markdown: "Top CA firms in Pune include **Acme Associates** and Beta & Co.",
  items: [
    {
      type: "ai_overview_element",
      text: "Acme Associates is known for GST filing.",
      references: [{ type: "ai_overview_reference", source: "Acme", domain: "acme.in", url: "https://www.acme.in/gst", title: "GST filing" }],
      links: [{ type: "link_element", url: "https://justdial.com/pune/ca", domain: "justdial.com", title: "CA in Pune" }],
    },
  ],
  references: [
    { type: "ai_overview_reference", domain: "beta.co.in", url: "https://beta.co.in/", title: "Beta" },
    { type: "ai_overview_reference", domain: "acme.in", url: "https://www.acme.in/gst", title: "dup" },
  ],
};
const payload = (items: unknown[], cost = 0.004) => ({ cost, tasks: [{ status_code: 20000, result: [{ items }] }] });

describe("AI Overview parsing", () => {
  it("finds the overview, its text and every cited URL once", () => {
    const p = parseAiOverviewPayload(payload([{ type: "organic", url: "https://x.com" }, aio]));
    expect(p.shown).toBe(true);
    expect(p.text).toBe(aio.markdown);
    expect(p.citations.map((c) => c.url)).toEqual(["https://beta.co.in/", "https://www.acme.in/gst", "https://justdial.com/pune/ca"]);
    expect(p.domains).toEqual(["beta.co.in", "acme.in", "justdial.com"]);
    expect(p.costUsd).toBe(0.004);
  });
  it("uses nested element text when there is no top-level markdown, and reports no overview", () => {
    const nested = parseAiOverviewPayload(payload([{ ...aio, markdown: undefined }]));
    expect(nested.text).toContain("known for GST filing");
    const none = parseAiOverviewPayload(payload([{ type: "organic" }]));
    expect(none).toMatchObject({ shown: false, text: "", citations: [] });
    expect(parseAiOverviewPayload(null).shown).toBe(false);
  });
  it("maps locales to DataForSEO locations and escapes keywords", () => {
    expect(serpLocation("en-IN")).toEqual({ location_code: 2356, language_code: "en" });
    expect(serpLocation("hi")).toEqual({ location_code: 2356, language_code: "hi" });
    expect(serpLocation("en-BR")).toEqual({ location_name: "Brazil", language_code: "en" });
    expect(serpLocation("en-NL")).toEqual({ location_name: "Netherlands", language_code: "en" });
    expect(serpKeyword(" 100% veg + jain ")).toBe("100%25 veg %2B jain");
    expect(isSerpProviderId("google_aio")).toBe(true);
    expect(isSerpProviderId("gemini")).toBe(false);
  });
});

describe("Google AI Overviews provider", () => {
  const ctx = { brandNames: ["Acme Associates"], competitors: [{ name: "Beta & Co", domain: "beta.co.in", aliases: [] }], websiteDomain: "acme.in", websiteUrl: "https://acme.in" };
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    flags.clear();
    budget.settled = [];
    budget.released = 0;
    for (const k of ["OPENAI_API_KEY", "GEMINI_API_KEY", "PERPLEXITY_API_KEY", "OPENROUTER_API_KEY"]) vi.stubEnv(k, "");
    vi.stubEnv("DATAFORSEO_LOGIN", "l");
    vi.stubEnv("DATAFORSEO_PASSWORD", "p");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is a real platform only when DataForSEO is configured, never simulated", async () => {
    expect((await getAvailableProviders(ctx)).map((p) => p.id)).toEqual(["dataforseo", "google_aio", "google_ai_mode"]);
    const d = await describeProviders();
    expect(d.providers.find((p) => p.id === "google_aio")).toMatchObject({ label: "Google AI Overviews", configured: true, simulated: false });
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    expect(googleAiOverviewsProvider.isConfigured()).toBe(false);
    await expect(googleAiOverviewsProvider.run({ promptId: "q", text: "x", locale: "en-IN" })).rejects.toMatchObject({ errorClass: "permanent" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the question to the organic SERP with async AI Overviews and feeds the Observation pipeline", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload([aio])), { status: 200 }));
    const a = await googleAiOverviewsProvider.run({ promptId: "q", text: "best CA firm in Pune", locale: "en-IN" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.dataforseo.com/v3/serp/google/organic/live/advanced");
    expect(JSON.parse(String(init.body))).toEqual([{ keyword: "best CA firm in Pune", location_code: 2356, language_code: "en", device: "desktop", depth: 10, load_async_ai_overview: true }]);
    expect(a).toMatchObject({ provider: "google_aio", platformLabel: "Google AI Overviews", simulated: false, costMicros: 4000 });
    expect(budget.settled).toEqual([4000]);
    const parsed = parseAnswer(a, ctx);
    expect(parsed.brandMentioned).toBe(true);
    expect(parsed.brandCited).toBe(true);
    expect(parsed.citations.map((c) => c.domain)).toContain("justdial.com");
    const m = computeMetrics([{ provider: a.provider, ...parsed, simulated: false }], { from: new Date(0), to: new Date(), brandLabel: "Acme Associates" });
    expect(m.byProvider.google_aio).toEqual({ collected: 1, mentionRate: 1, citationRate: 1 });
  });

  it("records 'no AI Overview' as a real, labelled result (brand not mentioned) and still settles the cost", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload([{ type: "organic" }], 0.002)), { status: 200 }));
    const a = await googleAiOverviewsProvider.run({ promptId: "q", text: "acme associates pune", locale: "en-IN" });
    expect(a.answerText).toBe(NO_AI_OVERVIEW_TEXT);
    expect(a.citations).toEqual([]);
    expect(a.limitations).toMatch(/^Google showed no AI Overview/);
    expect(parseAnswer(a, ctx).brandMentioned).toBe(false);
    expect(budget.settled).toEqual([2000]);
  });

  it("releases the budget hold on HTTP and task errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("x", { status: 500 }));
    await expect(googleAiOverviewsProvider.run({ promptId: "q", text: "x", locale: "en-IN" })).rejects.toMatchObject({ errorClass: "transient" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ tasks: [{ status_code: 40501 }] }), { status: 200 }));
    await expect(googleAiOverviewsProvider.run({ promptId: "q", text: "x", locale: "en-IN" })).rejects.toMatchObject({ errorClass: "permanent" });
    expect(budget.released).toBe(2);
  });

  it("AI Mode uses its own endpoint and label", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload([aio])), { status: 200 }));
    const a = await googleAiModeProvider.run({ promptId: "q", text: "best CA firm in Pune", locale: "en-IN" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.dataforseo.com/v3/serp/google/ai_mode/live/advanced");
    expect(a.platformLabel).toBe("Google AI Mode");
  });

  it("shows product names, not Gemini, in the app", () => {
    expect(engineName("google_aio")).toBe("Google AI Overviews");
    expect(engineName("Google AI Overviews")).toBe("Google AI Overviews");
    expect(engineName("google_ai_mode")).toBe("Google AI Mode");
    expect(engineName("gemini")).toBe("Gemini");
  });
});
