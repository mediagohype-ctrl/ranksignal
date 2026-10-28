# AI Visibility & Optimization SaaS (working name: RankSignal)

This SaaS measures how a brand appears in AI search answers and traditional search. It audits the brand's site and recommends evidence-backed fixes. It executes approved changes safely, then re-measures.
It is built from the product blueprint v1.0. See [docs/COMPETITIVE_ANALYSIS.md](docs/COMPETITIVE_ANALYSIS.md) for the feature map against Upranke.

## Quick start (local)

```bash
npm install                 # also runs prisma generate
cp .env.example .env        # then fill SESSION_SECRET and CREDENTIALS_KEY (64 hex chars each)
npm run db:push             # create SQLite dev DB
npm run db:seed             # demo@example.com / demo-password-123 (staff user)
npm run dev                 # http://localhost:3000 — worker runs in-process
```

If `OPENAI_API_KEY` and the DataForSEO credentials are not set, visibility runs use the simulated provider. Its data is fake but deterministic, and it is always labelled "Simulated demo data" in the UI. Set `ALLOW_SIMULATED_PROVIDER=false` in production.

## Architecture (blueprint §4)

The app is a modular monolith: Next.js App Router for the UI and API, Prisma for the database (SQLite in dev, PostgreSQL/Supabase in prod), and a durable DB-backed workflow queue.

| Layer | Path |
|---|---|
| Web app (marketing) | `src/app/(marketing)` |
| Product app | `src/app/app`, `src/components/app`, `src/components/ui` |
| Auth / orgs / billing / admin | `src/lib/auth`, `src/lib/billing`, `src/app/api/{auth,org,billing,webhooks,usage,admin}`, `src/middleware.ts` |
| Workflow queue (states, retries, backoff, idempotency) | `src/lib/jobs` (`npm run worker` for a separate process) |
| Crawler (SSRF-safe) + audit rules | `src/lib/crawler`, `src/lib/audit` |
| LLM + visibility providers, metrics, prompt research | `src/lib/providers`, `src/lib/visibility`, `src/lib/prompts` |
| Recommendations, policy engine, approvals, connectors, execution/rollback | `src/lib/recommendations`, `src/lib/policy`, `src/lib/actions`, `src/lib/connectors` |
| Shared contracts | `src/lib/types.ts`, `src/lib/api.ts` |

Workflow: trigger → preflight (plan/credits/flags) → crawl → audit → visibility measurement → analyze → policy classification → approval gate (exact draft hash) → execute (idempotency key + expected version) → validate → rollback if needed → re-measure → report.

## Moving to PostgreSQL

1. In `prisma/schema.prisma`, set `provider = "postgresql"` and point `DATABASE_URL` at Postgres.
2. Run `npx prisma migrate dev --name init`.
3. Add row-level security policies keyed on `organizationId` (blueprint §7). The app layer already scopes every query by organization.

## Tests

```bash
npm test          # vitest: SSRF, normalization, audit rules, metrics, parsing, policy, approvals, crypto, webhooks, quotas
npm run typecheck
```
