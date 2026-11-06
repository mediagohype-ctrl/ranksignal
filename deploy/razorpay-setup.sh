#!/usr/bin/env bash
# Switch on Razorpay payments in one go. Run from the project folder on your PC (Git Bash):
#
#   bash deploy/razorpay-setup.sh <VPS_IP> <rzp_key_id> <rzp_key_secret> [webhook_secret]
#
# 1. Creates the three monthly plans (Starter / Growth / Agency, prices from src/lib/billing/plans.ts) in your
#    Razorpay account using the API keys — each run creates new plans, so run it once per key pair.
# 2. Saves the keys, the webhook secret and the new plan ids in the server's .env and restarts the app.
set -euo pipefail

VPS_IP="${1:-}"; KEY_ID="${2:-}"; KEY_SECRET="${3:-}"; WEBHOOK_SECRET="${4:-}"
die() { echo -e "\033[1;31mError:\033[0m $*" >&2; exit 1; }
[ -n "$VPS_IP" ] && [ -n "$KEY_ID" ] && [ -n "$KEY_SECRET" ] || die "usage: bash deploy/razorpay-setup.sh <VPS_IP> <key_id> <key_secret> [webhook_secret]"
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || die "run this inside the project folder"

price() { # INR monthly price for a plan id, read from plans.ts so the site and Razorpay always agree
  awk -v id="$1" '$0 ~ "^  "id": [{]" {f=1} f && /priceInrMonthly:/ {gsub(/[^0-9]/,"",$2); print $2; exit}' src/lib/billing/plans.ts
}

create_plan() { # name, rupees → plan id
  local name="$1" rupees="$2" out
  out="$(curl -sS -u "$KEY_ID:$KEY_SECRET" -H 'Content-Type: application/json' https://api.razorpay.com/v1/plans \
    -d "{\"period\":\"monthly\",\"interval\":1,\"item\":{\"name\":\"MyWebRank $name\",\"amount\":$((rupees * 100)),\"currency\":\"INR\",\"description\":\"MyWebRank $name plan, monthly\"}}")"
  local id; id="$(printf '%s' "$out" | grep -o '"id":"plan_[A-Za-z0-9]*"' | head -n1 | cut -d'"' -f4)"
  [ -n "$id" ] || die "Razorpay refused to create the $name plan: $(printf '%s' "$out" | grep -o '"description":"[^"]*"' | head -n1)"
  echo "$id"
}

declare -A IDS
for p in starter growth agency; do
  rupees="$(price "$p")"; [ -n "$rupees" ] || die "no price for $p in src/lib/billing/plans.ts"
  name="$(tr '[:lower:]' '[:upper:]' <<< "${p:0:1}")${p:1}"
  IDS[$p]="$(create_plan "$name" "$rupees")"
  echo "  created $name ₹$rupees/month → ${IDS[$p]}"
done

ARGS=(RAZORPAY_KEY_ID="$KEY_ID" RAZORPAY_KEY_SECRET="$KEY_SECRET"
      RAZORPAY_PLAN_STARTER="${IDS[starter]}" RAZORPAY_PLAN_GROWTH="${IDS[growth]}" RAZORPAY_PLAN_AGENCY="${IDS[agency]}")
[ -n "$WEBHOOK_SECRET" ] && ARGS+=(RAZORPAY_WEBHOOK_SECRET="$WEBHOOK_SECRET")
echo "Saving on the server (asks for the VPS root password)…"
bash deploy/set-env.sh "$VPS_IP" "${ARGS[@]}"
