#!/usr/bin/env bash
# Why didn't a payment switch the plan on? Shows, for one customer email, what the server knows. Run from the
# project folder on your PC (Git Bash):
#
#   bash deploy/check-payment.sh <VPS_IP> <customer-email>
set -euo pipefail
VPS_IP="${1:-}"; EMAIL="${2:-}"
[ -n "$VPS_IP" ] && [[ "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]] || { echo "usage: bash deploy/check-payment.sh <VPS_IP> <customer-email>" >&2; exit 1; }

ssh -o StrictHostKeyChecking=accept-new "root@$VPS_IP" "EMAIL='$EMAIL' bash -s" <<'REMOTE'
set -uo pipefail
cd /var/www/ranksignal
q() { sudo -u postgres psql -d ranksignal -P pager=off -v email="$EMAIL" "$@"; }

echo "== 1. Razorpay settings on the server"
for k in RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET RAZORPAY_PLAN_STARTER RAZORPAY_PLAN_GROWTH RAZORPAY_PLAN_AGENCY; do
  v="$(grep -E "^$k=" .env | tail -n1 | cut -d= -f2- | tr -d '"')"
  if [ -z "$v" ]; then echo "  $k = (EMPTY)"; elif [[ "$k" == *SECRET* ]]; then echo "  $k = (set)"; else echo "  $k = ${v:0:14}..."; fi
done

echo
echo "== 2. Did Razorpay call our webhook? (last 10 calls; 200 = accepted, 401 = wrong webhook secret, 501 = secret empty)"
grep -h 'POST /api/webhooks/razorpay' /var/log/nginx/access.log /var/log/nginx/access.log.1 2>/dev/null | tail -n 10 | awk '{print "  " $4 "] status " $9}' || true
[ -n "$(grep -h 'POST /api/webhooks/razorpay' /var/log/nginx/access.log /var/log/nginx/access.log.1 2>/dev/null | head -n1)" ] || echo "  NONE — Razorpay has never called https://mywebrank.tech/api/webhooks/razorpay"

echo
echo "== 3. Webhook events saved (last 10)"
q -c 'SELECT "type", "processedAt" FROM "WebhookEvent" ORDER BY "processedAt" DESC LIMIT 10;'

echo "== 4. This customer's account and subscriptions"
q <<'SQL'
SELECT o.name AS business, o."planId" AS plan, o.status, m.role
  FROM "User" u JOIN "Membership" m ON m."userId" = u.id JOIN "Organization" o ON o.id = m."organizationId"
 WHERE lower(u.email) = lower(:'email');
SELECT s."providerSubscriptionId" AS razorpay_sub, s."planId" AS plan, s.status, s."createdAt"
  FROM "Subscription" s JOIN "Membership" m ON m."organizationId" = s."organizationId" JOIN "User" u ON u.id = m."userId"
 WHERE lower(u.email) = lower(:'email') ORDER BY s."createdAt" DESC;
SQL

echo "== 5. App errors about billing (last 24 hours)"
journalctl -u ranksignal --since '24 hours ago' --no-pager 2>/dev/null | grep -iE 'billing|razorpay|webhook' | tail -n 8 || true
REMOTE
