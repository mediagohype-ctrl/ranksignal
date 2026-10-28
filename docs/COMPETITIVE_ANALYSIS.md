# Competitive feature map — Upranke vs. our blueprint

Source: Upranke's public homepage (upranke.com), reviewed 2026-10-27. This covers only publicly visible features.
No code, copy or assets were taken from it.

| Upranke public feature | Our module | Status in this build | Where we differ |
|---|---|---|---|
| AI Prompt Research | `src/lib/prompts/research.ts` | Built (LLM + template fallback, dedupe) | Customer approves and edits the tracked prompt set; prompt sets are versioned |
| AI Search Analytics (mention frequency) | `src/lib/visibility/*` | Built | Shows sample size, window and provider label on every metric |
| Competitive Benchmarking / Competitor Gap | `metrics.competitorShare` + recommendations | Built | Comparison briefs are generated from evidence |
| Domain Citation Tracking / Citation Tracker | `parse.ts` citations (owned vs third-party) | Built | Separates the customer's own domain from third-party sources |
| Brand Visibility Index | `metrics.visibilityIndex` | Built (formula `vi-1`, versioned) | Formula is documented and versioned |
| Content Audit | `src/lib/crawler/*`, `src/lib/audit/*` | Built (SSRF-safe crawler, ~20 rules) | Includes AI-crawler access and structured-data checks |
| Multi-Country Tracking | project countries/languages, prompt locale | Partial (locale tagging; provider locale depends on API) | — |
| 5 AI platforms coverage | Provider adapters (OpenAI web search, DataForSEO, simulated) | Adapters in place; coverage depends on licensed provider | Blueprint forbids unofficial scraping of consumer UIs |
| AEO Agent (brand-aware chat) | — | Not built (post-V1) | Could be built on top of `generateStructured` and the evidence store |
| Managed "done-for-you" strategy | Action and approval center + connectors | Built as software: policy engine, exact-hash approvals, WordPress connector, rollback | Automates execution under risk classes A–D |
| 7-day trial, first scan in about 3 min | Trial plan + onboarding auto-starts crawl, prompts and visibility run | Built | — |

## Our differentiators (from the blueprint)
1. Controlled execution: risk-class policy, approval bound to the exact draft hash, before-state capture, validation and rollback.
2. Honest measurement: sample-based metrics, discontinuity markers when prompt sets change, no causal claims.
3. CMS-agnostic connector interface with explicit capability limits (WordPress first, then Git PR, Shopify).
4. Pricing aimed at Indian businesses (₹2,999 / ₹7,999 / ₹19,999+) with agency plans.
