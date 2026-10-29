# Build brief — AI Visibility & Optimization SaaS (shared by all build agents)

Product: multi-tenant SaaS that audits websites, measures brand mentions/citations in AI answers
(ChatGPT/Gemini/Perplexity-style), recommends fixes, executes explicitly authorized low-risk changes,
gates material changes behind approval of an exact draft hash, and re-measures. Placeholder brand in
`src/lib/brand.ts` (BRAND.name). Original product — do not copy any competitor's copy, logos or branding.

## Stack (already installed — DO NOT run npm install or add dependencies)
Next.js 15.5 App Router + React 19 + TypeScript (strict) + Tailwind v4 (`@import "tailwindcss"` in globals.css),
Prisma 6 + SQLite (`prisma/schema.prisma` — read it; DO NOT edit it), zod 3, jose, bcryptjs, cheerio,
ipaddr.js, robots-parser, recharts 3, lucide-react, clsx, openai 5, vitest 3. Node 22. Windows host.
Route params in Next 15 are async: `{ params }: { params: Promise<{ id: string }> }`.

## Existing core (read before coding; do not modify — report needed changes instead)
- `src/lib/db.ts` — `db` Prisma client.
- `src/lib/types.ts` — shared contracts (workflow states, Connector, VisibilityProvider, metrics, policy types, projectInputSchema, JobError).
- `src/lib/api.ts` — `handler()`, `json()`, `HttpError`, `requireSession(minRole)`, `requireProject(session, id)`, `parseBody(req, schema)`.
  Every route: `export const POST = handler(async (req, { params }) => { const s = await requireSession("member"); ... })`.
- `src/lib/auth/session.ts` — `getSession()`, `setSessionCookie(ctx)`, `clearSessionCookie()`.
- `src/lib/jobs/queue.ts` — `enqueue({kind, organizationId, projectId, input, idempotencyKey})`; handlers get `JobContext`
  with `ctx.run`, `ctx.transition(state, eventName, data)`, `ctx.event(name, data)`. Throw `JobError(msg, "transient"|"permanent"|"policy"|"quota")`.
  `src/lib/jobs/index.ts` imports these EXACT named exports (you must provide yours):
  `crawlJob` from `@/lib/crawler/job`, `visibilityJob` from `@/lib/visibility/job`, `analyzeJob` from `@/lib/recommendations/job`,
  `executeActionJob` + `rollbackJob` from `@/lib/actions/job`. Type: `JobHandler` from `@/lib/jobs/queue`.
- `src/lib/audit-log.ts` — `writeAuditLog({...})` for approvals, executions, connector/credential changes, support access.
- `src/lib/flags.ts` — `isEnabled(key)`, `setFlag()`; key `global.publishing` is the global publish kill switch.

## Cross-module contracts (implement yours exactly; call others' as specified even before they exist)
- **Billing/usage** (`@/lib/billing/*`, owned by auth-billing agent):
  - `plans.ts`: `PLANS: Record<PlanId, PlanLimits>`, `getPlan(planId: string): PlanLimits`.
  - `usage.ts`: `reserveCredits(orgId: string, o: {provider: string; taskType: string; credits: number; runId?: string; projectId?: string}): Promise<void>`
    (throws `JobError("...", "quota")` / HttpError 402 when over plan), `recordUsage(orgId, o: {provider; taskType; credits; costMicros; runId?; projectId?}): Promise<void>`,
    `releaseReservation(orgId, o: {provider; taskType; credits; runId?}): Promise<void>`, `getUsageSummary(orgId): Promise<{period: string; used: number; reserved: number; limit: number; byTaskType: Record<string, number>}>`.
- **LLM** (`@/lib/providers/llm.ts`, owned by visibility agent): `isLlmConfigured(): boolean`,
  `generateStructured<T>(o: {schema: z.ZodType<T>; system: string; user: string; maxTokens?: number}): Promise<{data: T; costMicros: number} | null>`
  — returns null when OPENAI_API_KEY is absent; output validated against schema; untrusted content passed in `user` delimited and never as instructions.
- **Connectors** (`@/lib/connectors/registry.ts`, owned by actions agent): `getConnectorForIntegration(integrationId, orgId): Promise<Connector>`.
- **Credentials crypto** (`@/lib/crypto.ts`, owned by actions agent): `encryptSecret(plain): string`, `decryptSecret(cipher): string` (AES-256-GCM, CREDENTIALS_KEY hex).
- **Crawler safe fetch** (`@/lib/crawler/safe-fetch.ts`, owned by crawler agent): `safeFetch(url, {maxBytes?, timeoutMs?, maxRedirects?}): Promise<{finalUrl; status; headers: Headers; body: string; redirectChain: string[]}>`
  — SSRF-safe; any module fetching customer-supplied URLs must use it.
- **Metrics** (`@/lib/visibility/metrics.ts`): `computeMetrics(observations, opts) : VisibilityMetrics`.

## API conventions
- List: `{ items: Row[], nextCursor?: string }`; create/get: `{ item: Row }`; errors: `{ error: {code, message, details?} }`.
- Every tenant query filters by `organizationId` from the session. Never trust ids from the body for tenancy.
- JSON columns are nullable — read with `(row.x as T | null) ?? default`.
- Never return `credentialEncrypted` or secrets to the client; never log them.
- Treat crawled page text and provider answers as untrusted data.

## Rules
- Only create/edit files in YOUR owned paths (listed in your task). If you need something from another area, code against the contract above.
- Don't run `next build` or `next dev` (other agents are mid-edit). Verify with `npx tsc --noEmit` and fix errors in YOUR files only
  (ignore errors from other agents' in-progress files/missing modules). Run your vitest tests: `npx vitest run tests/<yours>`.
- Match the blueprint: no guaranteed-ranking claims, simulated data always labelled, measured outcomes separated from causal claims.
- Keep code production-quality but lean; we have ~40 minutes. Finish with a short report: files created, contracts implemented, known gaps.

---
# ROUND 2 (2026-10-28) — polish + real reports
The app now builds (`npx next build` passes) and the full pipeline works end to end (crawl → audit → visibility → analyze → approvals).
Goals: (1) every page looks excellent and consistent; (2) reports are REAL: SEO/AEO/GEO scores and plain-English
"what's wrong / why it matters / how to fix" for the brand and website, computed from real crawl data and real AI answers.

- **Font:** "Google Sans Flex" everywhere (loaded via Google Fonts `<link>` in src/app/layout.tsx, exposed as CSS var
  `--font-sans`; Tailwind `font-sans` maps to it). Never set another font-family (code blocks may use a mono stack).
- **Design system:** `src/components/ui/*` + tokens in `src/app/globals.css`. Use primitives and tokens; no ad-hoc hex colours in pages.
  Read `docs/DESIGN_SYSTEM.md` (written by the design-system agent) before restyling any page.
- **Report contract:** `src/lib/report/types.ts` (`SiteReport`). Engine `buildSiteReport(projectId, organizationId): Promise<SiteReport>` in
  `src/lib/report/build.ts`; API `GET /api/projects/[id]/report` → `{ item: SiteReport }`.
- Plain language: write for a small-business owner. No jargon without a short explanation. No guaranteed outcomes.
- Verification: `npx tsc --noEmit` must be clean for your files; run your tests. Still don't run `next dev/build`.

---
# ROUND 3 (2026-10-28) — production completeness
The app is LIVE at https://ranksignal.onrender.com (Render, single always-on instance running the job worker in-process)
on Neon PostgreSQL. Goal: make it safe and complete for real self-serve customers.

## HARD RULES THIS ROUND
- The local `.env` points at the PRODUCTION database. NEVER run anything that touches the DB: no `next dev/start/build`,
  no tsx scripts, no prisma commands. Verify only with `npx tsc --noEmit`, `npx vitest run <your tests>` (db mocked), `npx eslint <paths>`.
- NO schema changes (prisma/schema.prisma is frozen). Store small per-project config in `Project.settings` JSON and use
  signed tokens (jose, SESSION_SECRET-derived key with a distinct `aud`) instead of new tables.
- Follow docs/DESIGN_SYSTEM.md for every UI (white background, Google Sans Flex, @/components/ui primitives).
- Every new external service is OPTIONAL: when its env vars are missing the feature degrades gracefully (log/skip), never crashes.
- Middleware already allows unauthenticated `/api/public/**` (same-origin enforced for POST) and pages outside /app,/admin.

## Shared contracts (implement yours exactly; others call them even before they exist)
- **Email** (agent: accounts) `src/lib/email/send.ts`: `sendEmail(o: {to: string; subject: string; html: string; text: string; replyTo?: string}): Promise<{ok: boolean; id?: string; skipped?: boolean}>`
  — Resend REST API when RESEND_API_KEY + EMAIL_FROM set, otherwise logs a one-line notice (never the body) and returns {ok:false, skipped:true}.
  `src/lib/email/layout.ts`: `renderEmail(o: {title: string; preheader?: string; paragraphs: string[]; cta?: {label: string; url: string}; footer?: string}): {html: string; text: string}`
  (simple, inline-styled, white background, escapes all input). Put YOUR templates in your own folder and build them with renderEmail.
- **Captcha** (agent: accounts) `src/lib/security/turnstile.ts`: `isTurnstileEnabled(): boolean`, `verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean>`
  (Cloudflare Turnstile; returns true when TURNSTILE_SECRET_KEY unset). Client widget `src/components/turnstile.tsx`: `<Turnstile onToken={(t)=>…} />`
  rendering nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset.
- **Rate limit** (exists): `src/lib/auth/rate-limit.ts` (in-memory, single instance is fine).
- **AI budget** (agent: billing) `src/lib/billing/ai-budget.ts`: `assertAiBudget(): Promise<void>` — throws `JobError(msg, "quota")` when today's (UTC)
  total AI spend across all orgs (sum UsageLedger.costMicros) ≥ AI_DAILY_BUDGET_USD (default 5). `getAiBudgetStatus(): Promise<{spentUsd; limitUsd; remainingUsd}>`.
- **Plan access** (agent: billing) `src/lib/billing/access.ts`: `getOrgAccess(orgId): Promise<{active: boolean; reason?: "trial_expired"|"past_due"|"cancelled"|"suspended"; trialEndsAt?: Date|null; planId: string}>`
  and `assertOrgActive(orgId)` (HttpError 402 code "plan_inactive"). Used before starting scans.
- **Schedules** (agent: automation) live in `Project.settings.schedule = {crawl: "off"|"weekly"|"monthly", visibility: "off"|"weekly"|"monthly"}`.
- **Share links** (agent: sharing) live in `Project.settings.share = {enabled: boolean; tokenId: string}` (tokenId rotates to revoke).

---
# ROUND 4 (2026-10-28) — service delivery: history, work board, monthly impact reports, admin, packages
Business direction: software + done-for-you service. We fix clients' sites and send a monthly impact report.
Done-for-you tiers (Organization.serviceTier): fix ₹19,999/mo, grow ₹49,999/mo, authority ₹1,19,999/mo (+ setup fees;
3–6 month minimums). Self-serve plans unchanged. Promise delivery, never rankings/placement.

## HARD RULES (unchanged from round 3, plus)
- Local .env = PRODUCTION DB. Never run next dev/start/build, tsx scripts or prisma commands. Verify with tsc, vitest, eslint only.
- prisma/schema.prisma was updated by the coordinator (new models ReportSnapshot, Task, TaskComment, MonthlyReport, Lead,
  AdminNote; Organization.serviceTier). The client is regenerated. Do NOT edit the schema; ask the coordinator.
- Access: use requireSession / requireAppSession (now enforce membership OR staff "support mode": SessionContext.staffMode).
  Staff (User.isStaff) enter a client org via POST /api/admin/orgs/[id]/enter (admin agent builds it) which issues a session
  with {organizationId, role:"admin", staffMode:true}. Show/allow staff-only controls when session.staffMode is true.
- Design: docs/DESIGN_SYSTEM.md, white background, Google Sans Flex, @/components/ui primitives. Honest copy, plain English.

## Contracts
- Snapshots (agent: history) `src/lib/snapshots/index.ts`:
  `writeSnapshot(o: {organizationId; projectId; kind: "crawl"|"visibility"; crawlRunId?; visibilityRunId?}): Promise<void>` (never throws; logs)
  `listSnapshots(projectId, organizationId, o?: {from?: Date; to?: Date; kind?: "crawl"|"visibility"}): Promise<SnapshotView[]>` (excludes simulated by default)
  `getSnapshotAt(projectId, organizationId, at: Date, kind): Promise<SnapshotView|null>` (latest at/before `at`)
  `computeDelta(before: SnapshotView|null, after: SnapshotView|null): SnapshotDelta` — overall/pillars/issues/visibility rate deltas +
  `notes: string[]` (methodology or prompt-set changes, simulated data, missing baseline). Types exported from `src/lib/snapshots/types.ts`.
- Work (agent: work) `src/lib/tasks/index.ts`:
  `listShippedWork(projectId, organizationId, from: Date, to: Date, o?: {clientVisibleOnly?: boolean}): Promise<ShippedItem[]>` where
  ShippedItem = {kind: "task"|"change"; title; category; performedBy: "agency"|"client"|"system"; completedAt: Date; url?: string; taskId?; actionId?}
  ("change" = succeeded ActionExecution; tasks = status done with completedAt in range).
  `listOpenWork(projectId, organizationId): Promise<{title; status; category; dueAt?: Date|null}[]>` (for "next month" plan).
- Monthly reports (agent: monthly) `src/lib/monthly-report/`: payload type `MonthlyReportPayload` in types.ts;
  `generateMonthlyReport(projectId, organizationId, period: "YYYY-MM"): Promise<MonthlyReport row>`.
- Leads (agent: admin) write `Lead` rows from POST /api/public/free-check (source free_check, url, score, ipHash) and
  /api/public/contact (source contact, name, email, company, message).

---
# ROUND 5 (2026-10-29) — finish every promised feature + backend hardening
Everything the website promises must actually work. Plus security & reliability fixes from the backend review.

## HARD RULES (as round 3/4)
- Local .env = PRODUCTION DB. Never run next dev/start/build, tsx scripts or prisma CLI. Verify: tsc, vitest, eslint only.
- Schema already updated by the coordinator (do NOT edit): Organization.branding Json?, ReportSnapshot.report Json? (+ relation),
  Task/MonthlyReport/ReportSnapshot → Project cascade, AdminNote → Organization cascade, new OffsiteItem, new MetricDaily,
  Observation index (visibilityRunId, createdAt). Client regenerated. Migration file exists, not yet applied.
- Next.js upgraded to 15.5.28 / React 19.1.10 (security). Don't add npm dependencies; use fetch.
- Captcha stays optional/off (owner's decision). Don't make it mandatory.
- Design: docs/DESIGN_SYSTEM.md; honest copy; external services optional (degrade gracefully when env vars are missing).

## Connector plugin contract (connector agents)
- Implement `Connector` from src/lib/types.ts in `src/lib/connectors/<id>.ts`. Every outbound HTTP call to a customer-supplied host
  MUST be SSRF-safe: call `assertPublicUrl` and pin the resolved IP (reuse the pinned-lookup approach in src/lib/crawler/safe-fetch.ts;
  you may export a small `safeRequest(url, {method, headers, body, timeoutMs, maxBytes})` helper from a NEW file
  src/lib/net/safe-request.ts — the GitHub agent owns that file; others import it). Fixed vendor API hosts (api.github.com,
  *.myshopify.com, api.webflow.com, api.contentful.com, *.api.sanity.io, www.wixapis.com) still go through safeRequest.
- Export a descriptor from `src/lib/connectors/catalog/<id>.ts`:
  `export const descriptor: ConnectorDescriptor` with {id, family, name, status: "available", description, capabilities: ConnectorCapabilities,
  connectFields: {key, label, type: "text"|"password"|"url", help}[], setupSteps: string[], create(config, secrets): Connector,
  validateConfig(input): {config, secrets}}` — type `ConnectorDescriptor` lives in src/lib/connectors/catalog/types.ts (GitHub agent creates it first; others code against this shape).
- Generic connect route (GitHub agent builds): POST /api/integrations/[provider]/connect {projectId, ...fields} → validateConfig, create(...).testConnection(),
  encrypt secrets (src/lib/crypto.ts), store Integration {provider, config, credentialEncrypted, capabilities, health}. Admin+ only. Audit-logged.
- Do NOT edit src/lib/connectors/registry.ts or src/components/app/integrations-panel.tsx — the coordinator wires all descriptors in at the end.
- Writes: drafts by default where the platform supports drafts; publish only through the existing approval gate; record before-state for rollback;
  honest capability flags (never claim rollback/publish you can't do).

## Other contracts
- Env validation (security agent): `src/lib/env.ts` exports `validateEnv(): {ok: boolean; errors: string[]; warnings: string[]}` and
  `assertProductionEnv()` (throws in NODE_ENV=production on fatal errors). Reliability agent calls assertProductionEnv() in src/instrumentation.ts.
- Structured logging (reliability agent): `src/lib/log.ts` exports `log.info|warn|error(event: string, fields?: Record<string, unknown>)` (JSON lines,
  redacts keys matching /secret|token|password|key|authorization/i). Everyone may import it.
- Stored report (reliability agent): `getStoredReport(projectId, organizationId): Promise<SiteReport | null>` in src/lib/report/stored.ts —
  reads the newest ReportSnapshot.report; falls back to buildSiteReport (without LLM) only if none.
- Google metrics (google agent): `syncGoogleMetricsDue(): Promise<void>` in src/lib/google/sync.ts (coordinator wires into the scheduler);
  `getSearchSummary(projectId, organizationId, from, to)` for reports.
- Branding (white-label agent): `getBranding(organizationId): Promise<Branding>` in src/lib/branding.ts (falls back to BRAND).
