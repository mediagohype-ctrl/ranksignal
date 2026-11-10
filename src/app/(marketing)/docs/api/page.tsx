import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Prose } from "@/components/marketing/ui";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, webPageLd } from "@/lib/seo/schema";
import { API_PLAN_LIMITS } from "@/lib/api-keys/limits";
import { LOOKER_FIELDS } from "@/lib/public-api/looker";
import { MCP_TOOLS } from "@/lib/public-api/mcp-tools";

const DOCS_API_TITLE = "API, MCP server and Looker Studio guide";
const DOCS_API_DESCRIPTION =
  "Read your MyWebRank scores, issues, AI visibility and Search Console data with a read-only REST API, an MCP server for AI tools and Looker Studio.";

export const metadata: Metadata = staticPageMetadata("/docs/api");

const BASE = `https://${BRAND.domain}`;

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "api-keys", label: "API keys" },
  { id: "requests", label: "Requests and responses" },
  { id: "limits", label: "Limits, paging and caching" },
  { id: "endpoints", label: "Endpoints" },
  { id: "mcp", label: "MCP server for AI tools" },
  { id: "looker-studio", label: "Looker Studio" },
];

const SECTION = "scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0 [&:not(:first-child)]:mt-10";

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-surface-2 p-4 font-mono text-[0.8rem] leading-relaxed text-fg">
      <code className="!bg-transparent !p-0">{children}</code>
    </pre>
  );
}

const ENDPOINTS: { path: string; what: string; params?: string; example: string }[] = [
  { path: "/api/v1/projects", what: "Your websites (projects), newest first, with their latest scores.", params: "cursor, limit (1–100, default 50)", example: "/api/v1/projects" },
  { path: "/api/v1/projects/{id}", what: "One project: latest scores, brand names, competitors and when it was last checked.", example: "/api/v1/projects/PROJECT_ID" },
  { path: "/api/v1/projects/{id}/report", what: "The latest full report: overall and pillar scores with every check, issues with fixes, AI visibility summary and the plain-English summary. Reading it never starts a new check.", example: "/api/v1/projects/PROJECT_ID/report" },
  { path: "/api/v1/projects/{id}/issues", what: "Issues from the latest report, highest impact first.", params: "pillar (seo, aeo, geo, brand), impact (high, medium, low), cursor, limit (1–100)", example: "/api/v1/projects/PROJECT_ID/issues?impact=high" },
  { path: "/api/v1/projects/{id}/scores", what: "Score history: one entry per finished website check or AI check, newest first. Demo data is never included.", params: "from, to (YYYY-MM-DD), kind (crawl, visibility), cursor, limit (1–500)", example: "/api/v1/projects/PROJECT_ID/scores?from=2026-01-01" },
  { path: "/api/v1/projects/{id}/visibility", what: "The latest finished AI check: mention, citation and recommendation rates, and for each question what each AI assistant said (with a short excerpt and the links it cited).", example: "/api/v1/projects/PROJECT_ID/visibility" },
  { path: "/api/v1/projects/{id}/search-performance", what: "Google Search Console (and GA4) numbers from the daily sync, compared with the previous period. gsc and ga4 are null until connected.", params: "from, to (default: last 28 days)", example: "/api/v1/projects/PROJECT_ID/search-performance" },
  { path: "/api/v1/projects/{id}/looker", what: "One flat row per day for dashboards and spreadsheets (see Looker Studio below).", params: "from, to (default: last 90 days, at most 366)", example: "/api/v1/projects/PROJECT_ID/looker?from=2026-08-01&to=2026-10-31" },
];

export default function ApiDocsPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageLd("/docs/api", { type: "TechArticle", name: DOCS_API_TITLE, description: DOCS_API_DESCRIPTION }),
          breadcrumbLd([
            { name: "Docs", path: "/docs" },
            { name: "API", path: "/docs/api" },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Docs"
        title={DOCS_API_TITLE}
        intro={<p>Pull your numbers into your own scripts, dashboards and AI assistants. Everything here is read-only.</p>}
      />
      <div className="bg-bg py-12 sm:py-16">
        <div className="container-marketing grid gap-8 lg:grid-cols-[240px_1fr] lg:gap-12">
          <nav aria-label="Guide contents">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-card lg:sticky lg:top-24 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
              <p className="flex items-center gap-2 text-caption uppercase tracking-[0.06em] text-muted">
                <BookOpen aria-hidden size={14} />
                On this page
              </p>
              <ol className="mt-3 space-y-0.5 lg:border-l lg:border-border">
                {TOC.map((t, i) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      className="flex gap-2 rounded-md py-1.5 text-small text-muted transition-colors hover:text-fg lg:-ml-px lg:rounded-none lg:border-l lg:border-transparent lg:pl-4 lg:hover:border-primary"
                    >
                      <span className="tabular-nums text-muted">{i + 1}.</span>
                      {t.label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="min-w-0 rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-10">
            <Prose>
              <section id="overview" aria-labelledby="overview-h" className={SECTION}>
                <h2 id="overview-h">Overview</h2>
                <p>{BRAND.name} gives you three read-only ways to use your data outside the app:</p>
                <ul>
                  <li>
                    <strong>REST API</strong> at <code>{BASE}/api/v1</code>: JSON for scripts, internal tools and client
                    dashboards. The machine-readable description is at <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>{" "}
                    (OpenAPI 3.1).
                  </li>
                  <li>
                    <strong>MCP server</strong> at <code>{BASE}/api/mcp</code>: lets AI tools such as Claude or Cursor read
                    your reports and answer questions about them.
                  </li>
                  <li>
                    <strong>Looker Studio connector</strong>: a daily time series of your scores, AI mention rate and Search
                    Console numbers.
                  </li>
                </ul>
                <p>
                  None of these can change anything, in {BRAND.name} or on your website. Numbers are the same ones you see in
                  the app: real measurements only, with demo answers clearly marked as <code>simulated</code>.
                </p>
              </section>

              <section id="api-keys" aria-labelledby="api-keys-h" className={SECTION}>
                <h2 id="api-keys-h">API keys</h2>
                <ol>
                  <li>
                    Sign in, open <Link href="/app/settings/api">Settings → API keys</Link> and click <strong>Create key</strong>.
                    Only owners and admins can do this.
                  </li>
                  <li>
                    Copy the key. It starts with <code>mwr_</code> and is shown <strong>once</strong>: we only keep a
                    fingerprint of it, so nobody (including us) can show it to you again.
                  </li>
                  <li>
                    Keep it secret, like a password. If it leaks, <strong>revoke</strong> it in the same screen; anything using it
                    stops working straight away.
                  </li>
                </ol>
                <p>
                  A key belongs to your workspace, not to a person, and can read every website in that workspace. Creating and
                  revoking keys is recorded in your workspace&apos;s activity log.
                </p>
              </section>

              <section id="requests" aria-labelledby="requests-h" className={SECTION}>
                <h2 id="requests-h">Requests and responses</h2>
                <p>
                  Send the key in the <code>Authorization</code> header on every request:
                </p>
                <Code>{`curl -H "Authorization: Bearer mwr_YOUR_KEY" \\\n  ${BASE}/api/v1/projects`}</Code>
                <p>Every successful response has the same shape:</p>
                <Code>{`{
  "data": [ { "id": "clx…", "name": "Sharma Dental", "websiteUrl": "https://…",
              "latest": { "overallScore": 72, "grade": "C", "pillarScores": { "seo": 80, "aeo": 64, "geo": 58, "brand": 81 }, … } } ],
  "meta": { "nextCursor": null }
}`}</Code>
                <p>Errors use one shape too, with a stable <code>code</code> you can check in code:</p>
                <Code>{`{ "error": { "code": "invalid_api_key", "message": "This API key is not valid or was revoked.", "requestId": "…" } }`}</Code>
                <ul>
                  <li><code>401 unauthorized</code> / <code>invalid_api_key</code>: no key, wrong key or revoked key.</li>
                  <li><code>403 org_suspended</code>: the workspace is suspended.</li>
                  <li><code>404 not_found</code>: the project is not in your workspace. <code>report_not_available</code>: no website check has finished yet.</li>
                  <li><code>400 invalid_request</code> / <code>invalid_cursor</code>: a query parameter is wrong.</li>
                  <li><code>429 rate_limited</code> / <code>daily_limit_reached</code>: slow down; see <code>Retry-After</code>.</li>
                </ul>
                <p>
                  Quote the <code>requestId</code> (also in the <code>x-request-id</code> header) if you contact support. Scores
                  are 0–100; rates are fractions from 0 to 1; times are ISO 8601 in UTC.
                </p>
              </section>

              <section id="limits" aria-labelledby="limits-h" className={SECTION}>
                <h2 id="limits-h">Limits, paging and caching</h2>
                <p>
                  Each key may make <strong>{API_PLAN_LIMITS.starter.perMinute} requests a minute</strong>. Each workspace also
                  has a daily cap that resets at 00:00 UTC:{" "}
                  {(["trial", "starter", "growth", "agency"] as const)
                    .map((p) => `${p === "trial" ? "free trial" : p[0].toUpperCase() + p.slice(1)} ${API_PLAN_LIMITS[p].perDay.toLocaleString("en-IN")}`)
                    .join(", ")}
                  . Every response carries <code>X-RateLimit-Remaining</code> and <code>X-RateLimit-Daily-Remaining</code>.
                </p>
                <p>
                  <strong>Paging:</strong> list endpoints return up to <code>limit</code> items and a{" "}
                  <code>meta.nextCursor</code>. Pass it back as <code>?cursor=</code> to get the next page; it is{" "}
                  <code>null</code> on the last page.
                </p>
                <Code>{`curl -H "Authorization: Bearer mwr_YOUR_KEY" \\\n  "${BASE}/api/v1/projects/PROJECT_ID/scores?limit=100&cursor=NEXT_CURSOR"`}</Code>
                <p>
                  <strong>Caching:</strong> responses carry an <code>ETag</code>. Send it back as <code>If-None-Match</code> and
                  you get an empty <code>304 Not Modified</code> when nothing changed. Data changes only when a check finishes
                  or Search Console syncs (about once a day), so polling more than every few minutes gains nothing.
                </p>
                <Code>{`curl -i -H "Authorization: Bearer mwr_YOUR_KEY" \\\n  -H 'If-None-Match: W/"…etag from last time…"' \\\n  ${BASE}/api/v1/projects/PROJECT_ID/report`}</Code>
              </section>

              <section id="endpoints" aria-labelledby="endpoints-h" className={SECTION}>
                <h2 id="endpoints-h">Endpoints</h2>
                <p>All endpoints use <code>GET</code>. Get project ids from <code>/api/v1/projects</code>.</p>
                {ENDPOINTS.map((e) => (
                  <div key={e.path}>
                    <h3>
                      <code>GET {e.path}</code>
                    </h3>
                    <p>{e.what}</p>
                    {e.params && (
                      <p>
                        <strong>Query:</strong> {e.params}
                      </p>
                    )}
                    <Code>{`curl -H "Authorization: Bearer mwr_YOUR_KEY" \\\n  "${BASE}${e.example}"`}</Code>
                  </div>
                ))}
              </section>

              <section id="mcp" aria-labelledby="mcp-h" className={SECTION}>
                <h2 id="mcp-h">MCP server for AI tools</h2>
                <p>
                  The <a href="https://modelcontextprotocol.io">Model Context Protocol</a> lets AI assistants call tools. Our
                  server speaks the Streamable HTTP transport at <code>{BASE}/api/mcp</code>, uses the same API keys and
                  limits as the REST API, and offers these read-only tools:
                </p>
                <ul>
                  {MCP_TOOLS.map((t) => (
                    <li key={t.name}>
                      <code>{t.name}</code>: {t.description}
                    </li>
                  ))}
                </ul>
                <p>
                  <strong>Claude Code:</strong>
                </p>
                <Code>{`claude mcp add --transport http mywebrank ${BASE}/api/mcp \\\n  --header "Authorization: Bearer mwr_YOUR_KEY"`}</Code>
                <p>
                  <strong>Cursor, Claude Desktop and other clients</strong> that read an <code>mcpServers</code> JSON file:
                </p>
                <Code>{`{
  "mcpServers": {
    "mywebrank": {
      "url": "${BASE}/api/mcp",
      "headers": { "Authorization": "Bearer mwr_YOUR_KEY" }
    }
  }
}`}</Code>
                <p>
                  Clients that can only start local programs can use the <code>mcp-remote</code> bridge:{" "}
                  <code>npx mcp-remote {BASE}/api/mcp --header &quot;Authorization: Bearer mwr_YOUR_KEY&quot;</code>.
                  Then ask, for example: &quot;Which high-impact issues should I fix first on my website?&quot; or &quot;How
                  often did AI assistants mention us last month?&quot;
                </p>
                <p>
                  Under the hood it is JSON-RPC 2.0 over <code>POST</code>; supported methods are <code>initialize</code>,{" "}
                  <code>ping</code>, <code>tools/list</code> and <code>tools/call</code>. The server is stateless (no
                  session id, no event stream), so <code>GET</code> returns 405. To test it by hand:
                </p>
                <Code>{`curl -X POST ${BASE}/api/mcp \\
  -H "Authorization: Bearer mwr_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_projects","arguments":{}}}'`}</Code>
              </section>

              <section id="looker-studio" aria-labelledby="looker-studio-h" className={SECTION}>
                <h2 id="looker-studio-h">Looker Studio</h2>
                <p>
                  Our Looker Studio connector turns your {BRAND.name} history into charts next to your other marketing data.
                  It asks for an API key once (create one named &quot;Looker Studio&quot;), lets you pick a website, and gives
                  one row per day with these fields:
                </p>
                <ul>
                  {LOOKER_FIELDS.map((f) => (
                    <li key={f.name}>
                      <code>{f.name}</code>: {f.description}
                    </li>
                  ))}
                </ul>
                <p>
                  Scores and AI rates show the <strong>latest check on or before each day</strong>, carried forward until the
                  next check, so a weekly check draws steps rather than a smooth line. Nothing is estimated. Search Console
                  fields are that day&apos;s real totals and stay empty until Search Console is connected.
                </p>
                <p>
                  Ask us for the connector link, or{" "}
                  <a href={`mailto:${BRAND.supportEmail}?subject=Looker%20Studio%20connector`}>email support</a>. You can read the
                  same rows yourself, for example into Google Sheets or Excel:
                </p>
                <Code>{`curl -H "Authorization: Bearer mwr_YOUR_KEY" \\\n  "${BASE}/api/v1/projects/PROJECT_ID/looker?from=2026-08-01&to=2026-10-31"`}</Code>
              </section>
            </Prose>
          </article>
        </div>
      </div>
    </>
  );
}
