#!/usr/bin/env bash
# Why am I not getting free-tool alert emails? Checks the server step by step, then sends one test alert to the
# support inbox with a BCC copy to everyone in EMAIL_BCC (exactly how the app sends them).
# Run from the project folder on your PC (Git Bash):
#
#   bash deploy/check-alerts.sh <VPS_IP>
set -euo pipefail
VPS_IP="${1:-}"
[ -n "$VPS_IP" ] || { echo "usage: bash deploy/check-alerts.sh <VPS_IP>" >&2; exit 1; }

ssh -o StrictHostKeyChecking=accept-new "root@$VPS_IP" "bash -s" <<'REMOTE'
set -uo pipefail
cd /var/www/ranksignal
q() { sudo -u postgres psql -d ranksignal -P pager=off "$@"; }

echo "== 1. Is the new code deployed? (needs the ToolUse table)"
if q -tAc "select to_regclass('public.\"ToolUse\"')" | grep -q ToolUse; then
  echo "YES: ToolUse table exists"
else
  echo "NO: ToolUse table missing. Deploy first: bash deploy/deploy.sh <VPS_IP> mywebrank.tech"
fi
grep -q 'withToolUsage' src/app/api/public/free-check/route.ts 2>/dev/null && echo "YES: free check is tracked" || echo "NO: old free-check code on the server"
echo

echo "== 2. Mail settings (who gets the alerts)"
grep -E '^(EMAIL_FROM|EMAIL_BCC|EMAIL_REPLY_TO|TOOL_ALERT_EMAILS|TOOL_ALERT_TO|SMTP_USER)=' .env || true
grep -qE '^EMAIL_BCC=.+' .env || echo "EMAIL_BCC is NOT set: no Gmail copies will be sent"
grep -qE '^TOOL_ALERT_TO=.+' .env || echo "TOOL_ALERT_TO not set: alerts go to support@mywebrank.tech (the default)"
echo

echo "== 3. Last 10 tool runs (alerted = an email was sent)"
q -c 'select to_char("createdAt" at time zone '"'"'Asia/Kolkata'"'"', '"'"'DD Mon HH24:MI'"'"') as ist, tool, left(url,40) as url, ok, "errorCode", device, alerted, email from "ToolUse" order by "createdAt" desc limit 10' 2>/dev/null || echo "(no table yet)"
echo

echo "== 4. Email / alert errors in the last 24 hours"
journalctl -u ranksignal --since '24 hours ago' --no-pager 2>/dev/null | grep -E '\[email\]|\[tool-usage\]' | tail -n 10 || true
echo "(nothing above = no errors logged)"
echo

echo "== 5. Sending a test alert the same way the app does"
node --env-file=.env - <<'JS'
const nodemailer = require("nodemailer");
const port = Number(process.env.SMTP_PORT || 465);
const to = process.env.TOOL_ALERT_TO || "support@mywebrank.tech";
const bcc = (process.env.EMAIL_BCC || "").split(",").map((s) => s.trim()).filter((e) => e && e.toLowerCase() !== to.toLowerCase());
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST, port,
  secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 15000, greetingTimeout: 15000,
});
t.sendMail({ from: process.env.EMAIL_FROM, to, bcc, subject: "MyWebRank test: free tool alert", text: "Test alert. If every team inbox got this, free-tool alerts will arrive too." })
  .then((i) => {
    console.log("SENT to " + to + (bcc.length ? " + BCC " + bcc.join(", ") : " (no BCC: EMAIL_BCC empty)"));
    console.log("accepted: " + (i.accepted || []).join(", "));
    if ((i.rejected || []).length) console.log("REJECTED: " + i.rejected.join(", "));
  })
  .catch((e) => { console.log("FAILED: " + [e.code, e.responseCode, e.response || e.message].filter(Boolean).join(" | ")); process.exit(1); });
JS
REMOTE
