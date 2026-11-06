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
# The plan's AI assistants are the first N of OPENROUTER_VISIBILITY_MODELS (Starter 3, Growth/Agency 5).
ORDER=""; i=0
IFS=',' read -ra MODELS <<< "$(envv OPENROUTER_VISIBILITY_MODELS)"
for m in "${MODELS[@]}"; do m="$(echo "$m" | tr -d " '")"; [ -n "$m" ] || continue; i=$((i + 1)); ORDER+="${ORDER:+,}('$m',$i)"; done
ORDER="${ORDER:-('none',1)}"
q() { sudo -u postgres psql -d ranksignal -P pager=off -v rate="$RATE" -v share="$SHARE" -v order="$ORDER" "$@"; }

echo "USD→INR rate: $RATE   ·   AI share of price: $SHARE"
echo
echo "== 1. Real cost per request, last 30 days (₹)"
echo "   Note: one visibility_prompt request = one question sent to ALL the plan's AI assistants (several answers)."
q <<'SQL'
SELECT "taskType" AS task, count(*) AS requests,
       round(avg("costMicros") / 1e6 * :rate, 2) AS avg_rs_each,
       round(sum("costMicros") / 1e6 * :rate, 0) AS total_rs
  FROM "UsageLedger"
 WHERE kind = 'actual' AND "costMicros" > 0 AND "createdAt" > now() - interval '30 days'
 GROUP BY 1 ORDER BY total_rs DESC;
SQL

echo "== 2. What each plan can afford (real cost of ONE answer = one question to one AI assistant, averaged over the plan's assistants)"
q <<'SQL'
WITH m AS (
  SELECT coalesce(model, provider) AS model, avg("costMicros") / 1e6 * :rate AS rs FROM "Observation"
   WHERE NOT simulated AND "costMicros" > 0 AND "createdAt" > now() - interval '30 days' GROUP BY 1
), o(model, ord) AS (VALUES :order),
p(plan, price, answers_now, engines) AS (VALUES ('starter', 2999, 300, 3), ('growth', 7999, 1200, 5), ('agency', 19999, 6000, 5)),
c AS (SELECT p.plan, avg(m.rs) AS rs FROM p JOIN o ON o.ord <= p.engines JOIN m ON m.model = o.model GROUP BY p.plan)
SELECT p.plan, p.price AS price_rs, round(p.price * :share) AS ai_budget_rs, p.answers_now,
       round(c.rs, 2) AS rs_per_answer,
       round(p.answers_now * c.rs) AS cost_if_all_used_rs,
       round(100 * p.answers_now * c.rs / p.price) AS pct_of_price,
       floor(p.price * :share / nullif(c.rs, 0)) AS answers_affordable
  FROM p JOIN c USING (plan) ORDER BY p.price;
SQL

echo "== 2b. Cost of one AI answer per AI assistant (model), last 30 days"
q <<'SQL'
SELECT coalesce(model, provider) AS assistant_model, count(*) AS answers,
       round(avg("costMicros") / 1e6 * :rate, 2) AS avg_rs_each,
       round(sum("costMicros") / 1e6 * :rate, 0) AS total_rs
  FROM "Observation"
 WHERE NOT simulated AND "costMicros" > 0 AND "createdAt" > now() - interval '30 days'
 GROUP BY 1 ORDER BY avg_rs_each DESC;
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
