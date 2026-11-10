// OpenAPI 3.1 description of the read-only public API v1 (served at /api/v1/openapi.json).
// Keep in step with src/app/api/v1/** and src/lib/public-api/service.ts (tests/public-api/openapi.test.ts checks paths).
import { BRAND } from "@/lib/brand";
import { LOOKER_FIELDS } from "./looker";

export const API_VERSION = "1.0.0";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const num = { type: "number" };
const int = { type: "integer" };
const str = { type: "string" };
const bool = { type: "boolean" };
const dateTime = { type: "string", format: "date-time" };
const pillarScores = {
  type: "object",
  properties: { seo: nullable(int), aeo: nullable(int), geo: nullable(int), brand: nullable(int) },
  required: ["seo", "aeo", "geo", "brand"],
};

const envelope = (data: Record<string, unknown>, paged = false) => ({
  type: "object",
  required: ["data"],
  properties: {
    data,
    ...(paged ? { meta: { type: "object", properties: { nextCursor: nullable(str) }, required: ["nextCursor"] } } : {}),
  },
});

const ok = (description: string, schema: Record<string, unknown>) => ({
  description,
  headers: {
    ETag: { schema: str, description: "Weak ETag; send it back as If-None-Match to get 304 Not Modified." },
    "X-RateLimit-Limit": { schema: int },
    "X-RateLimit-Remaining": { schema: int },
    "X-RateLimit-Reset": { schema: int, description: "Seconds until the per-minute window resets" },
    "X-RateLimit-Daily-Limit": { schema: int },
    "X-RateLimit-Daily-Remaining": { schema: int },
  },
  content: { "application/json": { schema } },
});

const errors = {
  "304": { description: "Not modified (If-None-Match matched)" },
  "400": { $ref: "#/components/responses/BadRequest" },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "403": { $ref: "#/components/responses/Forbidden" },
  "404": { $ref: "#/components/responses/NotFound" },
  "429": { $ref: "#/components/responses/RateLimited" },
};

const projectId = { name: "id", in: "path", required: true, schema: str, description: "Project id (from GET /api/v1/projects)" };
const cursor = { name: "cursor", in: "query", schema: str, description: "Opaque cursor from meta.nextCursor of the previous page" };
const limit = (def: number, max: number) => ({ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: max, default: def } });
const from = (days: number) => ({ name: "from", in: "query", schema: { type: "string", format: "date" }, description: `First day (UTC, YYYY-MM-DD). Default: ${days} days before \`to\`.` });
const to = { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "Last day (UTC, YYYY-MM-DD). Default: yesterday." };

const get = (operationId: string, summary: string, description: string, parameters: unknown[], response: Record<string, unknown>) => ({
  get: { operationId, summary, description, tags: ["Read"], parameters, responses: { "200": response, ...errors } },
});

export function buildOpenApiSpec(serverUrl: string = BRAND.appUrl) {
  return {
    openapi: "3.1.0",
    info: {
      title: `${BRAND.name} API`,
      version: API_VERSION,
      description:
        "Read-only access to your projects, reports, issues, score history, AI visibility and Search Console numbers. " +
        "Authenticate with an organization API key: `Authorization: Bearer mwr_…` (create one in Settings → API). " +
        "Every response is `{ data, meta? }`; errors are `{ error: { code, message, requestId } }`.",
      contact: { email: BRAND.supportEmail },
    },
    servers: [{ url: serverUrl.replace(/\/$/, "") }],
    security: [{ apiKey: [] }],
    tags: [{ name: "Read", description: "Read-only endpoints" }],
    paths: {
      "/api/v1/projects": get(
        "listProjects",
        "List projects",
        "Projects (websites) in the key's organization, newest first, with their latest scores.",
        [cursor, limit(50, 100)],
        ok("Projects", envelope({ type: "array", items: ref("ProjectSummary") }, true)),
      ),
      "/api/v1/projects/{id}": get("getProject", "Get a project", "One project with its latest scores and check dates.", [projectId], ok("Project", envelope(ref("ProjectDetail")))),
      "/api/v1/projects/{id}/report": get(
        "getReport",
        "Latest report",
        "The latest stored report (scores, pillars, issues, AI visibility, summary). Reading it never triggers a new check.",
        [projectId],
        ok("Report", envelope(ref("SiteReport"))),
      ),
      "/api/v1/projects/{id}/issues": get(
        "listIssues",
        "List issues",
        "Issues from the latest report, highest impact first.",
        [
          projectId,
          { name: "pillar", in: "query", schema: { type: "string", enum: ["seo", "aeo", "geo", "brand"] } },
          { name: "impact", in: "query", schema: { type: "string", enum: ["high", "medium", "low"] } },
          cursor,
          limit(50, 100),
        ],
        ok("Issues", {
          type: "object",
          required: ["data"],
          properties: {
            data: { type: "array", items: ref("Issue") },
            meta: { type: "object", properties: { nextCursor: nullable(str), total: int, generatedAt: dateTime } },
          },
        }),
      ),
      "/api/v1/projects/{id}/scores": get(
        "listScores",
        "Score history",
        "Scores frozen after each website check and AI check, newest first. Demo (simulated) data is never included.",
        [
          projectId,
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "kind", in: "query", schema: { type: "string", enum: ["crawl", "visibility"] } },
          cursor,
          limit(100, 500),
        ],
        ok("Score history", envelope({ type: "array", items: ref("ScorePoint") }, true)),
      ),
      "/api/v1/projects/{id}/visibility": get(
        "getVisibility",
        "AI visibility",
        "The latest finished AI check: mention, citation and recommendation rates, and what each AI assistant said for each question.",
        [projectId],
        ok("AI visibility", envelope(ref("Visibility"))),
      ),
      "/api/v1/projects/{id}/search-performance": get(
        "getSearchPerformance",
        "Search performance",
        "Google Search Console (and GA4) numbers stored by the daily sync, compared with the previous period. `gsc`/`ga4` are null when not connected.",
        [projectId, from(27), to],
        ok("Search performance", envelope({ type: "object", description: "SearchSummary: range, gsc, ga4" })),
      ),
      "/api/v1/projects/{id}/looker": get(
        "getLookerRows",
        "Daily series (Looker Studio)",
        "One flat row per day for dashboards: scores and AI rates as of that day (latest measurement carried forward), Search Console totals for that exact day (null when none).",
        [projectId, from(89), to],
        ok("Daily rows", {
          type: "object",
          required: ["data"],
          properties: {
            data: { type: "array", items: ref("LookerRow") },
            meta: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, fields: { type: "array", items: { type: "object" } } } },
          },
        }),
      ),
    },
    components: {
      securitySchemes: {
        apiKey: { type: "http", scheme: "bearer", bearerFormat: "mwr_…", description: "Organization API key from Settings → API" },
      },
      responses: Object.fromEntries(
        (
          [
            ["BadRequest", "Invalid query parameter (invalid_request, invalid_cursor)"],
            ["Unauthorized", "Missing, unknown or revoked key (unauthorized, invalid_api_key)"],
            ["Forbidden", "Workspace suspended or key lacks scope (org_suspended, insufficient_scope)"],
            ["NotFound", "Project not in this organization, or no report yet (not_found, report_not_available)"],
            ["RateLimited", "Too many requests (rate_limited, daily_limit_reached); see Retry-After"],
          ] as const
        ).map(([name, description]) => [name, { description, content: { "application/json": { schema: ref("Error") } } }]),
      ),
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "object", required: ["code", "message", "requestId"], properties: { code: str, message: str, details: {}, requestId: str } } },
        },
        LatestScores: {
          type: "object",
          properties: { overallScore: nullable(int), grade: nullable(str), pillarScores, openIssues: nullable(int), measuredAt: dateTime },
        },
        ProjectSummary: {
          type: "object",
          required: ["id", "name", "websiteUrl", "createdAt", "latest"],
          properties: { id: str, name: str, websiteUrl: str, createdAt: dateTime, latest: nullable(ref("LatestScores")) },
        },
        ProjectDetail: {
          allOf: [
            ref("ProjectSummary"),
            {
              type: "object",
              properties: {
                brandNames: { type: "array", items: str },
                competitors: { type: "array", items: { type: "object", properties: { name: str, domain: nullable(str) } } },
                lastWebsiteCheckAt: nullable(dateTime),
                lastAiCheckAt: nullable(dateTime),
              },
            },
          ],
        },
        Issue: {
          type: "object",
          properties: {
            id: str,
            pillar: { type: "string", enum: ["seo", "aeo", "geo", "brand"] },
            title: str,
            whatsWrong: str,
            whyItMatters: str,
            howToFix: { type: "array", items: str },
            impact: { type: "string", enum: ["high", "medium", "low"] },
            effort: { type: "string", enum: ["quick", "moderate", "involved"] },
            affectedUrls: { type: "array", items: str },
            affectedCount: int,
            evidence: str,
          },
        },
        SiteReport: {
          type: "object",
          description: "Full report. See the docs for every field.",
          properties: {
            projectId: str,
            brand: str,
            websiteUrl: str,
            generatedAt: dateTime,
            overall: { type: "object", properties: { score: nullable(int), grade: nullable(str), headline: str, partial: bool } },
            pillars: { type: "array", items: { type: "object", properties: { pillar: str, label: str, score: nullable(int), grade: nullable(str), summary: str, checks: { type: "array", items: { type: "object" } } } } },
            issues: { type: "array", items: ref("Issue") },
            quickWins: { type: "array", items: str },
            strengths: { type: "array", items: str },
            aiVisibility: { type: "object" },
            executiveSummary: str,
            limitations: { type: "array", items: str },
            methodologyVersion: str,
          },
        },
        ScorePoint: {
          type: "object",
          properties: {
            id: str,
            kind: { type: "string", enum: ["crawl", "visibility"] },
            measuredAt: dateTime,
            overallScore: nullable(int),
            grade: nullable(str),
            pillarScores,
            openIssues: nullable({ type: "object", properties: { critical: int, high: int, medium: int, low: int, info: int, total: int } }),
            aiVisibility: nullable({
              type: "object",
              properties: { mentionRate: num, citationRate: num, recommendationRate: num, visibilityIndex: num, answers: int, providers: { type: "array", items: str } },
            }),
            methodologyVersion: str,
          },
        },
        Visibility: {
          type: "object",
          properties: {
            measured: bool,
            simulated: { type: "boolean", description: "True when the answers came from the demo provider, not real AI assistants" },
            run: nullable({ type: "object", properties: { id: str, finishedAt: nullable(dateTime), providers: { type: "array", items: str }, answersCollected: int, answersFailed: int } }),
            summary: nullable({
              type: "object",
              properties: { mentionRate: num, citationRate: num, recommendationRate: num, visibilityIndex: num, competitorShare: { type: "object", additionalProperties: num }, answers: int },
            }),
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  promptId: str,
                  question: str,
                  answers: int,
                  mentioned: int,
                  cited: int,
                  recommended: int,
                  mentionRate: num,
                  recommendedInstead: { type: "array", items: str },
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        provider: str,
                        platform: str,
                        mentioned: bool,
                        cited: bool,
                        recommended: bool,
                        citations: { type: "array", items: { type: "object", properties: { url: str, domain: str, owned: bool } } },
                        excerpt: str,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        LookerRow: {
          type: "object",
          properties: Object.fromEntries(
            LOOKER_FIELDS.map((f) => [f.name, f.type === "date" ? { type: "string", format: "date", description: f.description } : { ...nullable(num), description: f.description }]),
          ),
        },
      },
    },
  };
}
