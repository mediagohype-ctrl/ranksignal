#!/usr/bin/env bash
# Set (or change) settings in the server's .env and restart the app. Run from the project folder on your PC:
#
#   bash deploy/set-env.sh <VPS_IP> KEY=value [KEY=value ...]
#
# Example: bash deploy/set-env.sh 189.72.145.110 RAZORPAY_KEY_ID=rzp_live_xxx RAZORPAY_KEY_SECRET=yyy
# Secrets go straight to the server over SSH; nothing is written on your PC or into git.
set -euo pipefail

VPS_IP="${1:-}"; shift || true
SSH_USER="${SSH_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
die() { echo -e "\033[1;31mError:\033[0m $*" >&2; exit 1; }

[ -n "$VPS_IP" ] && [ $# -gt 0 ] || die "usage: bash deploy/set-env.sh <VPS_IP> KEY=value [KEY=value ...]"
LINES=""
for kv in "$@"; do
  [[ "$kv" =~ ^[A-Z][A-Z0-9_]*=.+$ ]] || die "not KEY=value: ${kv%%=*}"
  [[ "$kv" != *'"'* && "$kv" != *$'\n'* ]] || die "${kv%%=*}: value can't contain quotes or new lines"
  LINES+="$kv"$'\n'
done

B64="$(printf '%s' "$LINES" | base64 | tr -d '\n\r')"
ssh -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new "$SSH_USER@$VPS_IP" "B64=$B64 bash -s" <<'REMOTE'
set -euo pipefail
F=/var/www/ranksignal/.env
[ -f "$F" ] || { echo "No $F on the server — run deploy/deploy.sh first." >&2; exit 1; }
cp -p "$F" "$F.bak-$(date +%Y%m%d-%H%M%S)"
while IFS= read -r line; do
  [ -n "$line" ] || continue
  k="${line%%=*}"; v="${line#*=}"
  { grep -v "^$k=" "$F" || true; printf '%s="%s"\n' "$k" "$v"; } > "$F.tmp"
  cat "$F.tmp" > "$F" && rm -f "$F.tmp"
  echo "  set $k"
done < <(printf '%s' "$B64" | base64 -d)
systemctl restart ranksignal
for i in $(seq 1 30); do
  curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1 && { echo "App restarted and healthy."; exit 0; }
  sleep 2
done
echo "App did not come back — check: journalctl -u ranksignal -n 50" >&2; exit 1
REMOTE
