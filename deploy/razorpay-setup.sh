#!/usr/bin/env bash
# Switch on Razorpay payments in one go. Run from the project folder on your PC (Git Bash):
#
#   bash deploy/razorpay-setup.sh <VPS_IP> <rzp_key_id> <rzp_key_secret> [webhook_secret]
#   GSTIN=07ABCDE1234F1Z5 bash deploy/razorpay-setup.sh …     # GST-registered: plans charge price + GST
#
# 1. Creates the three monthly plans (Starter / Growth / Agency, prices from src/lib/billing/plans.ts) in your
#    Razorpay account using the API keys — each run creates NEW plans (Razorpay plan amounts can't be edited).
#    With GSTIN set, each plan's amount is price + GST (GST_RATE_PERCENT, default 18), because Razorpay charges
#    exactly the plan's amount. Without GSTIN: the plain price.
# 2. Saves the keys, the webhook secret, the new plan ids (and GSTIN / GST_LEGAL_NAME when given) in the server's
#    .env and restarts the app, so the website, checkout, invoices and Razorpay all use the same total.
set -euo pipefail

VPS_IP="${1:-}"; KEY_ID="${2:-}"; KEY_SECRET="${3:-}"; WEBHOOK_SECRET="${4:-}"
die() { echo -e "\033[1;31mError:\033[0m $*" >&2; exit 1; }
[ -n "$VPS_IP" ] && [ -n "$KEY_ID" ] && [ -n "$KEY_SECRET" ] || die "usage: bash deploy/razorpay-setup.sh <VPS_IP> <key_id> <key_secret> [webhook_secret]"
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || die "run this inside the project folder"

GSTIN="$(printf '%s' "${GSTIN:-}" | tr '[:lower:]' '[:upper:]' | tr -d ' ')"
if [ -n "$GSTIN" ]; then
  [[ "$GSTIN" =~ ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$ ]] || die "GSTIN '$GSTIN' doesn't look right (15 characters, like 07ABCDE1234F1Z5)"
  GST_PERCENT="${GST_RATE_PERCENT:-18}"
else
  GST_PERCENT=0
fi
[[ "$GST_PERCENT" =~ ^[0-9]+$ ]] || die "GST_RATE_PERCENT must be a whole number"
echo "GST: $([ "$GST_PERCENT" -gt 0 ] && echo "$GST_PERCENT% added to every plan (GSTIN $GSTIN)" || echo "not registered — plans charge the plain price")"

price() { # INR monthly price for a plan id, read from plans.ts so the site and Razorpay always agree
  awk -v id="$1" '$0 ~ "^  "id": [{]" {f=1} f && /priceInrMonthly:/ {gsub(/[^0-9]/,"",$2); print $2; exit}' src/lib/billing/plans.ts
}

total_paise() { # rupees → paise including GST, rounded like src/lib/billing/gst.ts (gst = round(base × rate / 100))
  local base=$(($1 * 100))
  echo $((base + (base * GST_PERCENT + 50) / 100))
}

create_plan() { # name, rupees → plan id
  local name="$1" rupees="$2" out amount desc
  amount="$(total_paise "$rupees")"
  desc="MyWebRank $name plan, monthly$([ "$GST_PERCENT" -gt 0 ] && echo " (Rs $rupees + $GST_PERCENT% GST)")"
  out="$(curl -sS -u "$KEY_ID:$KEY_SECRET" -H 'Content-Type: application/json' https://api.razorpay.com/v1/plans \
    -d "{\"period\":\"monthly\",\"interval\":1,\"item\":{\"name\":\"MyWebRank $name\",\"amount\":$amount,\"currency\":\"INR\",\"description\":\"$desc\"}}")"
  local id; id="$(printf '%s' "$out" | grep -o '"id":"plan_[A-Za-z0-9]*"' | head -n1 | cut -d'"' -f4)"
  [ -n "$id" ] || die "Razorpay refused to create the $name plan: $(printf '%s' "$out" | grep -o '"description":"[^"]*"' | head -n1)"
  echo "$id"
}

declare -A IDS
for p in starter growth agency; do
  rupees="$(price "$p")"; [ -n "$rupees" ] || die "no price for $p in src/lib/billing/plans.ts"
  name="$(tr '[:lower:]' '[:upper:]' <<< "${p:0:1}")${p:1}"
  IDS[$p]="$(create_plan "$name" "$rupees")"
  t="$(total_paise "$rupees")"
  printf '  created %s: ₹%s + GST = ₹%d.%02d/month → %s\n' "$name" "$rupees" $((t / 100)) $((t % 100)) "${IDS[$p]}"
done

ARGS=(RAZORPAY_KEY_ID="$KEY_ID" RAZORPAY_KEY_SECRET="$KEY_SECRET"
      RAZORPAY_PLAN_STARTER="${IDS[starter]}" RAZORPAY_PLAN_GROWTH="${IDS[growth]}" RAZORPAY_PLAN_AGENCY="${IDS[agency]}")
[ -n "$WEBHOOK_SECRET" ] && ARGS+=(RAZORPAY_WEBHOOK_SECRET="$WEBHOOK_SECRET")
if [ -n "$GSTIN" ]; then
  ARGS+=(GSTIN="$GSTIN" GST_RATE_PERCENT="$GST_PERCENT")
  [ -n "${GST_LEGAL_NAME:-}" ] && ARGS+=(GST_LEGAL_NAME="$GST_LEGAL_NAME")
fi
echo "Saving on the server (asks for the VPS root password)…"
bash deploy/set-env.sh "$VPS_IP" "${ARGS[@]}"
