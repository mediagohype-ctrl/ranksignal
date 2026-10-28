import { afterEach, describe, expect, it, vi } from "vitest";
import { geminiVisibilityProvider, parseGeminiResponse } from "@/lib/providers/visibility/gemini";
import { parsePerplexityResponse, perplexityVisibilityProvider } from "@/lib/providers/visibility/perplexity";
import { domainFromTitle, isRedirectCitationUrl, parseAnswer, toCitations } from "@/lib/visibility/parse";
import { JobError } from "@/lib/types";

const REDIRECT = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC123xyz";

const geminiFixture = {
  candidates: [
    {
      content: { role: "model", parts: [{ text: "Top picks: **Acme Tiles** is well reviewed. " }, { text: "Globex is cheaper.", thought: false }, { text: "internal", thought: true }] },
      finishReason: "STOP",
      groundingMetadata: {
        webSearchQueries: ["best tiles india"],
        groundingChunks: [
          { web: { uri: REDIRECT, title: "acmetiles.in" } },
          { web: { uri: `${REDIRECT}2`, title: "www.globex.com" } },
          { web: { uri: "https://example.org/review", title: "Tile review" } },
          { web: { uri: REDIRECT, title: "acmetiles.in" } }, // duplicate
          { retrievedContext: {} }, // non-web chunk ignored
        ],
      },
    },
  ],
  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, thoughtsTokenCount: 50 },
  modelVersion: "gemini-2.5-flash",
};

const ctx = { brandNames: ["Acme Tiles"], competitors: [{ name: "Globex", aliases: [] }], websiteUrl: "https://acmetiles.in" };

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("gemini response parsing", () => {
  it("extracts text (no thought parts), grounding citations and usage", () => {
    const r = parseGeminiResponse(geminiFixture);
    expect(r.text).toBe("Top picks: **Acme Tiles** is well reviewed. Globex is cheaper.");
    expect(r.citations).toHaveLength(3);
    expect(r.citations[0]).toEqual({ url: REDIRECT, title: "acmetiles.in" });
    expect(r.grounded).toBe(true);
    expect(r.inputTokens).toBe(100);
    expect(r.outputTokens).toBe(250);
    expect(parseGeminiResponse(null).text).toBe("");
    expect(parseGeminiResponse({ candidates: "x" }).citations).toEqual([]);
  });

  it("attributes redirect URIs to the domain in the title", () => {
    expect(isRedirectCitationUrl(REDIRECT)).toBe(true);
    expect(domainFromTitle("www.Globex.com")).toBe("globex.com");
    expect(domainFromTitle("Tile review")).toBeNull();
    const cites = toCitations(parseGeminiResponse(geminiFixture).citations, "acmetiles.in");
    expect(cites.map((c) => c.domain)).toEqual(["acmetiles.in", "globex.com", "example.org"]);
    expect(cites[0].ownedByCustomer).toBe(true);
    // Redirect with a non-domain title can't be attributed → dropped rather than guessed.
    expect(toCitations([{ url: REDIRECT, title: "Some article" }], "acmetiles.in")).toEqual([]);
    const parsed = parseAnswer({ answerText: parseGeminiResponse(geminiFixture).text, citations: parseGeminiResponse(geminiFixture).citations }, ctx);
    expect(parsed.brandCited).toBe(true);
    expect(parsed.brandMentioned).toBe(true);
  });

  it("runs against the API with header auth, google_search tool and a labelled answer", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    vi.stubEnv("GEMINI_MODEL", "");
    const f = mockFetch(geminiFixture);
    const a = await geminiVisibilityProvider.run({ promptId: "p", text: "best tiles?", locale: "en-IN" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(url).not.toContain("test-gemini-key");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-gemini-key");
    const body = JSON.parse(String(init?.body));
    expect(body.tools).toEqual([{ google_search: {} }]);
    expect(JSON.stringify(body.systemInstruction)).toContain("India");
    expect(a.platformLabel).toBe("Gemini (API, gemini-2.5-flash, Google Search grounding)");
    expect(a.simulated).toBe(false);
    expect(a.limitations).toContain("API answers can differ from the Gemini app and Google AI Overviews.");
    expect(a.costMicros).toBeGreaterThan(0);
  });

  it("classifies HTTP errors", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    mockFetch({ error: { status: "RESOURCE_EXHAUSTED" } }, 429);
    const err = await geminiVisibilityProvider.run({ promptId: "p", text: "q", locale: "en" }).catch((e) => e);
    expect(err).toBeInstanceOf(JobError);
    expect((err as JobError).errorClass).toBe("transient");
    expect((err as JobError).message).not.toContain("k\"");
    mockFetch({ error: { status: "PERMISSION_DENIED" } }, 403);
    const err2 = (await geminiVisibilityProvider.run({ promptId: "p", text: "q", locale: "en" }).catch((e) => e)) as JobError;
    expect(err2.errorClass).toBe("permanent");
  });
});

const pplxFixture = {
  id: "pplx-1",
  model: "sonar",
  choices: [{ message: { role: "assistant", content: "<think>hmm</think>Acme Tiles [1] and Globex [2] are popular." } }],
  search_results: [
    { title: "Acme Tiles", url: "https://acmetiles.in/" },
    { title: "Globex", url: "https://globex.com/tiles" },
  ],
  citations: ["https://acmetiles.in/", "https://news.example.com/a"],
  usage: { prompt_tokens: 20, completion_tokens: 80 },
};

describe("perplexity response parsing", () => {
  it("extracts text, search_results and citations (deduped), strips <think>", () => {
    const r = parsePerplexityResponse(pplxFixture);
    expect(r.text).toBe("Acme Tiles [1] and Globex [2] are popular.");
    expect(r.citations).toEqual([
      { url: "https://acmetiles.in/", title: "Acme Tiles" },
      { url: "https://globex.com/tiles", title: "Globex" },
      { url: "https://news.example.com/a", title: undefined },
    ]);
    expect(parsePerplexityResponse({ citations: ["https://a.com", 5, "not a url"] }).citations).toEqual([{ url: "https://a.com", title: undefined }]);
    expect(parsePerplexityResponse(undefined).text).toBe("");
  });

  it("passes country, bearer auth and uses reported cost when present", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "pk");
    const f = mockFetch({ ...pplxFixture, usage: { ...pplxFixture.usage, cost: { total_cost: 0.0061 } } });
    const a = await perplexityVisibilityProvider.run({ promptId: "p", text: "best tiles?", locale: "en-IN" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.perplexity.ai/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer pk");
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("sonar");
    expect(body.web_search_options).toEqual({ user_location: { country: "IN" } });
    expect(a.platformLabel).toBe("Perplexity (Sonar API)");
    expect(a.costMicros).toBe(6100);
    expect(a.citations).toHaveLength(3);
  });

  it("estimates cost from the price table when not reported", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "pk");
    mockFetch(pplxFixture);
    const a = await perplexityVisibilityProvider.run({ promptId: "p", text: "q", locale: "en" });
    expect(a.costMicros).toBe(5000 + 100); // request fee + (20+80) tokens at $1/M
  });
});
