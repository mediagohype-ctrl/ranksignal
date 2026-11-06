#!/usr/bin/env bash
# Check email on the server: shows the mail settings (password hidden), recent email errors, then logs in to
# the SMTP server and sends a test email. Run from the project folder on your PC (Git Bash):
#
#   bash deploy/test-email.sh <VPS_IP> <send-test-to@email.com>
set -euo pipefail
VPS_IP="${1:-}"; TO="${2:-}"
[ -n "$VPS_IP" ] && [[ "$TO" =~ ^[^[:space:]@\"\']+@[^[:space:]@\"\']+$ ]] || { echo "usage: bash deploy/test-email.sh <VPS_IP> <test-to@email.com>" >&2; exit 1; }

ssh -o StrictHostKeyChecking=accept-new "root@$VPS_IP" "TO='$TO' bash -s" <<'REMOTE'
set -uo pipefail
cd /var/www/ranksignal
echo "== Mail settings on the server"
grep -E '^(SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_USER|EMAIL_FROM|EMAIL_REPLY_TO|EMAIL_BCC|RESEND_API_KEY)=' .env | sed -E 's/^(RESEND_API_KEY=.{0,6}).*/\1…/'
if grep -qE '^SMTP_PASS="?[^"]+' .env; then echo 'SMTP_PASS=(set, hidden)'; else echo 'SMTP_PASS=(EMPTY)'; fi
echo
echo "== Email errors in the last 24 hours"
journalctl -u ranksignal --since '24 hours ago' --no-pager 2>/dev/null | grep -F '[email]' | tail -n 5 || true
echo
echo "== Logging in to the mail server and sending a test to $TO"
node --env-file=.env - <<'JS'
const nodemailer = require("nodemailer");
const port = Number(process.env.SMTP_PORT || 465);
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST, port,
  secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 15000, greetingTimeout: 15000,
});
t.verify()
  .then(() => { console.log("LOGIN OK as " + process.env.SMTP_USER); return t.sendMail({ from: process.env.EMAIL_FROM, to: process.env.TO, subject: "MyWebRank test email", text: "If you can read this, email from mywebrank.tech works." }); })
  .then((i) => console.log("SENT OK → " + process.env.TO + "  (" + i.response + ")"))
  .catch((e) => { console.log("FAILED: " + [e.code, e.responseCode, e.response || e.message].filter(Boolean).join(" | ")); process.exit(1); });
JS
REMOTE
