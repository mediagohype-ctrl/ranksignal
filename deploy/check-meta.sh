#!/usr/bin/env bash
# Is Meta (Pixel + Conversions API) set up on the server? Shows the Meta settings (token hidden), asks Meta whether
# the token works for the pixel, checks the live page has the pixel, and shows recent Meta errors from the app log.
# Run from the project folder on your PC (Git Bash):
#
#   bash deploy/check-meta.sh <VPS_IP>
set -euo pipefail
VPS_IP="${1:-}"
[ -n "$VPS_IP" ] || { echo "usage: bash deploy/check-meta.sh <VPS_IP>" >&2; exit 1; }

ssh -o StrictHostKeyChecking=accept-new "root@$VPS_IP" "bash -s" <<'REMOTE'
set -uo pipefail
cd /var/www/ranksignal

echo "== 1. Meta settings in the server's .env (token hidden)"
if grep -qE '^(NEXT_PUBLIC_)?META_' .env; then
  grep -E '^(NEXT_PUBLIC_)?META_' .env | sed -E 's/^(META_CAPI_TOKEN=.{0,8}).*/\1… (hidden)/'
else
  echo "No META_ lines at all."
fi
grep -qE '^META_CAPI_TOKEN=.+' .env || echo "!! META_CAPI_TOKEN is missing or empty: server events (Lead, sign-up, payment) are OFF."
if grep -qE '^META_PIXEL_ID=' .env && ! grep -qE '^META_PIXEL_ID=[0-9]{5,20}$' .env; then
  echo "!! META_PIXEL_ID is set but is not a plain number. Remove that line (the default 4537219149865300 is used) or fix it."
fi
echo

echo "== 2. Does Meta accept the token for the pixel?"
node --env-file=.env - <<'JS'
const raw = (process.env.META_PIXEL_ID || "").trim();
const pixel = /^\d{5,20}$/.test(raw) ? raw : "4537219149865300";
const token = (process.env.META_CAPI_TOKEN || "").trim();
if (!token) { console.log("No token to test."); process.exit(0); }
fetch(`https://graph.facebook.com/v21.0/${pixel}?fields=id,name&access_token=${encodeURIComponent(token)}`)
  .then((r) => r.json())
  .then((j) => {
    if (j.error) console.log(`NOT OK for pixel ${pixel}: ${j.error.message}`);
    else console.log(`OK: token works for pixel ${j.id} ("${j.name}")`);
  })
  .catch((e) => console.log("Could not reach Meta: " + e.message));
JS
echo

echo "== 3. Is the pixel on the live homepage?"
if curl -fsS --max-time 15 http://127.0.0.1:3000/ | grep -q "fbq('init'"; then
  echo "YES: $(curl -fsS --max-time 15 http://127.0.0.1:3000/ | grep -o "fbq('init','[0-9]*')" | head -1)"
else
  echo "NO: the page has no Meta Pixel. Deploy the latest code (the pages are built during the deploy)."
fi
echo

echo "== 4. Meta messages in the app log (last 24 hours)"
journalctl -u ranksignal --since '24 hours ago' --no-pager 2>/dev/null | grep -F '[meta]' | tail -n 10 || true
echo "(nothing above = no Meta errors logged)"
REMOTE
