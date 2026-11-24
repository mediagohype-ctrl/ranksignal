#!/usr/bin/env bash
# Why do blog image uploads fail? Shows the R2 settings on the server (secrets hidden), tries a real tiny upload with
# exactly those settings (then deletes it), opens it from the public URL, and shows recent upload errors from the log.
# Run from the project folder on your PC (Git Bash):
#
#   bash deploy/check-r2.sh <VPS_IP>
set -euo pipefail
VPS_IP="${1:-}"
[ -n "$VPS_IP" ] || { echo "usage: bash deploy/check-r2.sh <VPS_IP>" >&2; exit 1; }

ssh -o StrictHostKeyChecking=accept-new "root@$VPS_IP" "bash -s" <<'REMOTE'
set -uo pipefail
cd /var/www/ranksignal

echo "== 1. R2 settings in the server's .env (secrets hidden)"
for k in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME R2_PUBLIC_URL R2_UPLOAD_PREFIX; do
  line="$(grep -E "^$k=" .env | tail -n 1 || true)"
  if [ -z "$line" ]; then echo "$k = (MISSING)"; continue; fi
  val="${line#*=}"; val="${val%\"}"; val="${val#\"}"
  case "$k" in
    R2_SECRET_ACCESS_KEY|R2_ACCESS_KEY_ID) echo "$k = ${val:0:6}… (${#val} characters)";;
    *) echo "$k = $val";;
  esac
done
echo "(an access key id is 32 characters, a secret access key 64)"
echo

echo "== 2. Test upload with these settings"
node --env-file=.env - <<'JS'
const { AwsClient } = require("aws4fetch");
const e = process.env;
const acc = (e.R2_ACCOUNT_ID || "").trim(), bucket = (e.R2_BUCKET_NAME || "").trim(), pub = (e.R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");
const client = new AwsClient({ accessKeyId: (e.R2_ACCESS_KEY_ID || "").trim(), secretAccessKey: (e.R2_SECRET_ACCESS_KEY || "").trim(), service: "s3", region: "auto" });
const key = `${(e.R2_UPLOAD_PREFIX || "uploads").trim()}/blog/_server-test-${Date.now()}.txt`;
const url = `https://${acc}.r2.cloudflarestorage.com/${bucket}/${key}`;
(async () => {
  const put = await client.fetch(url, { method: "PUT", body: "ok", headers: { "Content-Type": "text/plain" } });
  if (!put.ok) {
    const t = await put.text();
    const code = (/<Code>([^<]+)<\/Code>/.exec(t) || [])[1] || `HTTP ${put.status}`;
    const msg = (/<Message>([^<]+)<\/Message>/.exec(t) || [])[1] || "";
    console.log(`UPLOAD FAILED: ${code} ${msg}`);
    if (/SignatureDoesNotMatch/.test(code)) console.log("→ The secret access key is wrong (often cut off when pasted). Set R2_SECRET_ACCESS_KEY again.");
    if (/InvalidAccessKeyId/.test(code)) console.log("→ The access key id is wrong. Set R2_ACCESS_KEY_ID again.");
    if (/NoSuchBucket/.test(code)) console.log("→ The bucket name is wrong. It must be exactly: mywebrank");
    if (/AccessDenied/.test(code)) console.log("→ The API token has no write access to this bucket. Edit the token in Cloudflare R2 → Manage API tokens.");
    process.exit(1);
  }
  console.log("UPLOAD OK →", bucket);
  if (pub) {
    const g = await fetch(`${pub}/${key}`);
    console.log("public URL:", g.status === 200 ? "OK" : `FAILED (${g.status}) — check R2_PUBLIC_URL and that public access is on`);
  }
  await client.fetch(url, { method: "DELETE" });
  console.log("test file deleted");
})().catch((err) => { console.log("FAILED:", err.message); process.exit(1); });
JS
echo

echo "== 3. Upload errors in the app log (last 24 hours)"
journalctl -u ranksignal --since '24 hours ago' --no-pager 2>/dev/null | grep -F '[uploads]' | tail -n 5 || true
echo "(nothing above = no upload errors logged)"
REMOTE
