#!/usr/bin/env bash
# One-command deploy to a Hostinger (or any Ubuntu) VPS. Run from the project folder on your PC (Git Bash):
#
#   bash deploy/deploy.sh <VPS_IP> [your-domain.com] [admin-email]
#
#   <VPS_IP>       e.g. 72.61.10.20 (root SSH login)
#   [domain]       optional; without it the site runs on https://<ip-with-dashes>.sslip.io (free, real SSL)
#   [admin-email]  optional; an existing account that gets access to the admin back-office
#
# What it does: packs the committed code (git HEAD) + your local .env + the Neon database address, copies them
# to the VPS over SSH and runs deploy/server-setup.sh there (Node, PostgreSQL, Nginx, SSL, firewall, backups,
# copies all Neon data into the VPS database on first install, builds and starts the app).
# Re-run the same command any time to ship new code; the server's .env and database are kept.
set -euo pipefail

# One password for the VPS database and the "ranksignal" Linux user. Change it here (and re-run) when you like.
APP_PASSWORD="${APP_PASSWORD:-Gohypmedia@2026}"

VPS_IP="${1:-}"
DOMAIN="${2:-}"
ADMIN_EMAIL="${3:-}"
SSH_USER="${SSH_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"

die() { echo -e "\033[1;31mError:\033[0m $*" >&2; exit 1; }
say() { echo -e "\033[1;35m==>\033[0m $*"; }

[ -n "$VPS_IP" ] || die "usage: bash deploy/deploy.sh <VPS_IP> [domain] [admin-email]"
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || die "run this inside the project folder"
[ -f .env ] || die ".env not found in $(pwd) — it holds your keys and the Neon database address"
command -v ssh >/dev/null || die "ssh not found (use Git Bash on Windows)"

# Warn (don't block) when the shipped code differs from what's on disk or on GitHub.
if [ -n "$(git status --porcelain)" ]; then
  echo "Note: you have uncommitted changes. Only committed code (git HEAD) is deployed."
fi
git fetch -q origin 2>/dev/null || true
if git rev-parse -q --verify origin/main >/dev/null && [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "Note: HEAD ($(git rev-parse --short HEAD)) is not the same as GitHub main. Deploying HEAD anyway."
fi

# The Neon *direct* (non-pooled) address is used once on the server to copy all data across.
env_value() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | sed -E 's/^["'\'']//; s/["'\'']$//'; }
NEON_URL="$(env_value DIRECT_URL)"
[ -n "$NEON_URL" ] || NEON_URL="$(env_value DATABASE_URL)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bundle/app"
say "Packing code $(git rev-parse --short HEAD)"
# autocrlf=false: shell scripts must keep Linux line endings.
git -c core.autocrlf=false archive --format=tar HEAD | tar -x -C "$TMP/bundle/app"
# Always ship the deploy scripts from this folder (they work even before you commit them), with Linux line endings.
mkdir -p "$TMP/bundle/app/deploy"
for f in deploy/*.sh; do sed 's/\r$//' "$f" > "$TMP/bundle/app/$f"; done
cp .env "$TMP/bundle/env.base"
printf '%s' "$NEON_URL" > "$TMP/bundle/neon.url"
printf '%s' "$APP_PASSWORD" > "$TMP/bundle/password"
printf 'DOMAIN=%q\nADMIN_EMAIL=%q\nLETSENCRYPT_EMAIL=%q\nIMPORT_DB=%q\nREFRESH_ENV=%q\n' \
  "$DOMAIN" "$ADMIN_EMAIL" "${LETSENCRYPT_EMAIL:-}" "${IMPORT_DB:-0}" "${REFRESH_ENV:-0}" > "$TMP/bundle/options"

SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)
say "Uploading to $SSH_USER@$VPS_IP (you may be asked for the VPS root password)"
tar -czf - -C "$TMP" bundle | ssh "${SSH_OPTS[@]}" "$SSH_USER@$VPS_IP" \
  'umask 077 && rm -rf /root/ranksignal-bundle && mkdir -p /root/ranksignal-bundle && tar -xzf - -C /root/ranksignal-bundle --strip-components=1'

say "Setting up the server (first time takes 10–15 minutes; asks for the password once more)"
ssh -t "${SSH_OPTS[@]}" "$SSH_USER@$VPS_IP" 'bash /root/ranksignal-bundle/app/deploy/server-setup.sh'
