#!/usr/bin/env bash
# AI cost report from the live database: what one AI answer really costs, what each customer costs this month
# compared with what they pay, and how many AI answers each plan can afford at a 30% AI share.
# Run from the project folder on your PC (Git Bash):
#
#   bash deploy/ai-costs.sh <VPS_IP>
set -euo pipefail
VPS_IP="${1:-}"
[ -n "$VPS_IP" ] || { echo "usage: bash deploy/ai-costs.sh <VPS_IP>" >&2; exit 1; }

ssh -o StrictHostKeyChecking=accept-new "root@$VPS_IP" 'bash -s' <<'REMOTE'
set -uo pipefail
cd /var/www/ranksignal
envv() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | tr -d '"'; }
RATE="$(envv ADMIN_USD_INR_RATE)"; RATE="${RATE:-95}"
SHARE="$(envv AI_COST_SHARE)"; SHARE="${SHARE:-0.3}"
q() { sudo -u postgres psql -d ranksignal -P pager=off -v rate="$RATE" -v share="$SHARE" "$@"; }

echo "USD→INR rate: $RATE   ·   AI share of price: $SHARE"
echo
echo "== 1. Real cost per AI request, last 30 days (₹)"
q <<'SQL'
SELECT "taskType" AS task, count(*) AS requests,
       round(avg("costMicros") / 1e6 * :rate, 2) AS avg_rs_each,
       round(sum("costMicros") / 1e6 * :rate, 0) AS total_rs
  FROM "UsageLedger"
 WHERE kind = 'actual' AND "costMicros" > 0 AND "createdAt" > now() - interval '30 days'
 GROUP BY 1 ORDER BY total_rs DESC;
SQL

echo "== 2. What each plan can afford (using the real average cost of one AI answer)"
q <<'SQL'
WITH a AS (
  SELECT avg("costMicros") / 1e6 * :rate AS rs FROM "UsageLedger"
   WHERE kind = 'actual' AND "costMicros" > 0 AND "taskType" = 'visibility_prompt' AND "createdAt" > now() - interval '30 days'
), p(plan, price, answers_now) AS (VALUES ('starter', 2999, 300), ('growth', 7999, 1200), ('agency', 19999, 6000))
SELECT p.plan, p.price AS price_rs, round(p.price * :share) AS ai_budget_rs, p.answers_now,
       round(p.answers_now * a.rs) AS cost_if_all_used_rs,
       round(100 * p.answers_now * a.rs / p.price) AS pct_of_price,
       floor(p.price * :share / nullif(a.rs, 0)) AS answers_affordable
  FROM p, a;
SQL

echo "== 3. This month: AI cost per customer vs what they pay"
q <<'SQL'
SELECT o.name AS business, o."planId" AS plan,
       round(sum(u."costMicros") / 1e6 * :rate, 0) AS ai_cost_rs,
       CASE o."planId" WHEN 'starter' THEN 2999 WHEN 'growth' THEN 7999 WHEN 'agency' THEN 19999 ELSE 0 END AS pays_rs
  FROM "UsageLedger" u JOIN "Organization" o ON o.id = u."organizationId"
 WHERE u.kind = 'actual' AND u."createdAt" >= date_trunc('month', now())
 GROUP BY o.id, o.name, o."planId" ORDER BY ai_cost_rs DESC LIMIT 20;
SQL
REMOTE
