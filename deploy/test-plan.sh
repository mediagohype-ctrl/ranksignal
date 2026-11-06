#!/usr/bin/env bash
# Test payments with real money but a tiny amount. Run from the project folder on your PC (Git Bash):
#
#   bash deploy/test-plan.sh <VPS_IP> on    # creates a ₹10/month Razorpay plan and makes "Starter" use it
#   bash deploy/test-plan.sh <VPS_IP> off   # puts the real Starter plan back
#
# While it is ON, anyone buying Starter pays ₹10 (the site still shows ₹2,999) — keep the window short.
# The Razorpay keys are read from the server's .env; nothing secret is stored on your PC.
set -euo pipefail
VPS_IP="${1:-}"; MODE="${2:-}"
[ -n "$VPS_IP" ] && [[ "$MODE" == on || "$MODE" == off ]] || { echo "usage: bash deploy/test-plan.sh <VPS_IP> on|off" >&2; exit 1; }

ssh -o StrictHostKeyChecking=accept-new "root@$VPS_IP" "MODE=$MODE bash -s" <<'REMOTE'
set -euo pipefail
F=/var/www/ranksignal/.env
get() { grep -E "^$1=" "$F" | tail -n1 | cut -d= -f2- | tr -d '"'; }
put() { { grep -v "^$1=" "$F" || true; printf '%s="%s"\n' "$1" "$2"; } > "$F.tmp" && cat "$F.tmp" > "$F" && rm -f "$F.tmp"; }
drop() { { grep -v "^$1=" "$F" || true; } > "$F.tmp" && cat "$F.tmp" > "$F" && rm -f "$F.tmp"; }
cp -p "$F" "$F.bak-$(date +%Y%m%d-%H%M%S)"

if [ "$MODE" = on ]; then
  if [ -n "$(get RAZORPAY_PLAN_STARTER_REAL)" ]; then echo "Test plan is already ON ($(get RAZORPAY_PLAN_STARTER))."; exit 0; fi
  KEY_ID="$(get RAZORPAY_KEY_ID)"; KEY_SECRET="$(get RAZORPAY_KEY_SECRET)"
  [ -n "$KEY_ID" ] && [ -n "$KEY_SECRET" ] || { echo "Razorpay keys are missing in $F" >&2; exit 1; }
  OUT="$(curl -sS -u "$KEY_ID:$KEY_SECRET" -H 'Content-Type: application/json' https://api.razorpay.com/v1/plans \
    -d '{"period":"monthly","interval":1,"item":{"name":"MyWebRank TEST plan","amount":1000,"currency":"INR","description":"Rs 10 test plan - delete after testing"}}')"
  ID="$(printf '%s' "$OUT" | grep -o '"id":"plan_[A-Za-z0-9]*"' | head -n1 | cut -d'"' -f4)"
  [ -n "$ID" ] || { echo "Razorpay refused: $(printf '%s' "$OUT" | grep -o '"description":"[^"]*"' | head -n1)" >&2; exit 1; }
  put RAZORPAY_PLAN_STARTER_REAL "$(get RAZORPAY_PLAN_STARTER)"
  put RAZORPAY_PLAN_STARTER "$ID"
  echo "TEST MODE ON: Starter now charges ₹10/month (Razorpay plan $ID)."
else
  REAL="$(get RAZORPAY_PLAN_STARTER_REAL)"
  [ -n "$REAL" ] || { echo "Test plan is not on — nothing to undo."; exit 0; }
  put RAZORPAY_PLAN_STARTER "$REAL"
  drop RAZORPAY_PLAN_STARTER_REAL
  echo "TEST MODE OFF: Starter is back to the real plan ($REAL)."
fi
systemctl restart ranksignal
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1 && { echo "App restarted and healthy."; exit 0; }; sleep 2; done
echo "App did not come back — check: journalctl -u ranksignal -n 50" >&2; exit 1
REMOTE
