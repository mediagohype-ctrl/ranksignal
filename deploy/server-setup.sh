#!/usr/bin/env bash
# Runs ON the VPS as root (started by deploy/deploy.sh). Safe to re-run: every step checks what's already there.
# Fresh Ubuntu → Node.js 22, PostgreSQL, Nginx + SSL, firewall, swap, nightly DB backups, the app as a systemd
# service (website + background job worker in one process), and on first install a full copy of the Neon data.
set -euo pipefail
trap 'echo -e "\n\033[1;31mFailed at line $LINENO.\033[0m Fix the problem above and re-run the same deploy command." >&2' ERR

BUNDLE=/root/ranksignal-bundle
APP_USER=ranksignal
APP_DIR=/var/www/ranksignal
DB_NAME=ranksignal
DB_USER=ranksignal
PORT=3000
BACKUP_DIR=/var/backups/ranksignal

[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
[ -d "$BUNDLE/app" ] || { echo "Bundle missing: run deploy/deploy.sh from your PC."; exit 1; }
# shellcheck disable=SC1091
source "$BUNDLE/options"
PASSWORD="$(cat "$BUNDLE/password")"
NEON_URL="$(cat "$BUNDLE/neon.url" 2>/dev/null || true)"

step() { echo -e "\n\033[1;35m==> $*\033[0m"; }
ok() { echo -e "    \033[32m✓\033[0m $*"; }
warn() { echo -e "    \033[33m!\033[0m $*"; }
as_app() { sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && $*"; }
urlencode() { python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"; }
sql_quote() { printf "%s" "$1" | sed "s/'/''/g"; }

PUBLIC_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
DOMAIN="${DOMAIN:-${PUBLIC_IP//./-}.sslip.io}"
APP_URL="https://$DOMAIN"
DB_URL="postgresql://$DB_USER:$(urlencode "$PASSWORD")@127.0.0.1:5432/$DB_NAME?schema=public"

# ------------------------------------------------------------------------------------------------------------
step "1/11 System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y sudo curl ca-certificates gnupg git rsync build-essential python3 openssl ufw \
  nginx postgresql postgresql-contrib postgresql-client certbot python3-certbot-nginx
ok "packages installed"

step "2/11 Swap (so the build never runs out of memory)"
if ! swapon --show | grep -q .; then
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "4 GB swap added"
else
  ok "swap already on"
fi

step "3/11 Node.js 22"
node_major() { command -v node >/dev/null && node -v | sed -E 's/^v([0-9]+).*/\1/' || echo 0; }
if [ "$(node_major)" -lt 20 ]; then
  if ! { curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs; }; then
    warn "NodeSource failed; installing the official Node.js 22 build instead"
    case "$(uname -m)" in x86_64) ARCH=x64 ;; aarch64|arm64) ARCH=arm64 ;; *) echo "Unsupported CPU $(uname -m)"; exit 1 ;; esac
    FILE="$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | awk "/linux-$ARCH.tar.xz/{print \$2}")"
    curl -fsSL "https://nodejs.org/dist/latest-v22.x/$FILE" | tar -xJ -C /usr/local --strip-components=1
  fi
fi
ok "node $(node -v), npm $(npm -v)"

step "4/11 App user and folder"
id -u "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
echo "$APP_USER:$PASSWORD" | chpasswd
mkdir -p "$APP_DIR"
# Code from the bundle; the server's .env, node_modules, build output and uploads are left in place.
rsync -a --delete --exclude '/.env' --exclude '/node_modules' --exclude '/.next' "$BUNDLE/app/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "code copied to $APP_DIR"

step "5/11 PostgreSQL database"
systemctl enable --now postgresql
PW_SQL="$(sql_quote "$PASSWORD")"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$PW_SQL';
  ELSE
    ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$PW_SQL';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
sudo -u postgres psql -q -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO $DB_USER;" >/dev/null
ok "database $DB_NAME (user $DB_USER) on 127.0.0.1:5432, local connections only"

step "6/11 Environment file (.env)"
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ] || [ "${REFRESH_ENV:-0}" = 1 ]; then
  # Start from your PC's .env (all API keys), then point it at this server.
  grep -vE '^(DATABASE_URL|DIRECT_URL|APP_URL|NODE_ENV|PORT|HOSTNAME|NEXT_DIST_DIR|ALLOW_SIMULATED_PROVIDER|RUN_WORKER_IN_APP|NEXT_MANUAL_SIG_HANDLE|TRUST_PROXY_HOPS)=' \
    "$BUNDLE/env.base" | tr -d '\r' > "$ENV_FILE.tmp"
  val() { grep -E "^$1=" "$ENV_FILE.tmp" | tail -n1 | cut -d= -f2- | tr -d '"'"'" || true; }
  if [ "$(val SESSION_SECRET | wc -c)" -lt 33 ]; then
    sed -i '/^SESSION_SECRET=/d' "$ENV_FILE.tmp"; echo "SESSION_SECRET=\"$(openssl rand -hex 32)\"" >> "$ENV_FILE.tmp"; warn "new SESSION_SECRET generated"
  fi
  if ! val CREDENTIALS_KEY | grep -qE '^[0-9a-fA-F]{64}$'; then
    sed -i '/^CREDENTIALS_KEY=/d' "$ENV_FILE.tmp"; echo "CREDENTIALS_KEY=\"$(openssl rand -hex 32)\"" >> "$ENV_FILE.tmp"; warn "new CREDENTIALS_KEY generated"
  fi
  cat >> "$ENV_FILE.tmp" <<EOF

# ---- Set by deploy/server-setup.sh ($(date -u +%F)) ----
DATABASE_URL="$DB_URL"
DIRECT_URL="$DB_URL"
APP_URL="$APP_URL"
ALLOW_SIMULATED_PROVIDER="false"
RUN_WORKER_IN_APP="true"
NEXT_MANUAL_SIG_HANDLE="true"
TRUST_PROXY_HOPS="1"
EOF
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  ok "written from your PC's .env (kept on later deploys; edit it on the server or deploy with REFRESH_ENV=1)"
else
  # Keep the server's keys, but follow a new domain if one was given.
  sed -i "s#^APP_URL=.*#APP_URL=\"$APP_URL\"#" "$ENV_FILE"
  ok "kept existing .env (APP_URL=$APP_URL)"
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE" && chmod 600 "$ENV_FILE"

step "7/11 Copy data from Neon"
TABLES="$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
if [ -n "$NEON_URL" ] && { [ "$TABLES" = 0 ] || [ "${IMPORT_DB:-0}" = 1 ]; }; then
  DUMP=/root/neon-$(date +%F-%H%M).dump
  echo "    Downloading everything from Neon (your Neon database is only read, never changed)…"
  pg_dump "$NEON_URL" --format=custom --no-owner --no-acl --schema=public --file="$DUMP"
  NEON_USERS="$(psql "$NEON_URL" -tAc 'SELECT count(*) FROM "User"' 2>/dev/null || echo "?")"
  # Start from an empty database so the copy is exact (this replaces anything already here), app stopped meanwhile.
  systemctl stop ranksignal 2>/dev/null || true
  sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$DB_NAME" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION $DB_USER;"
  # pg_restore needs a plain libpq address (no Prisma-only "?schema=public").
  PG_URL="postgresql://$DB_USER:$(urlencode "$PASSWORD")@127.0.0.1:5432/$DB_NAME"
  pg_restore --no-owner --no-acl -d "$PG_URL" "$DUMP" 2> /root/neon-restore.log || true
  if grep -v -E 'already exists|errors ignored on restore' /root/neon-restore.log | grep -q 'error'; then
    warn "restore messages (full log: /root/neon-restore.log):"; grep 'error' /root/neon-restore.log | head -10
  fi
  USERS="$(sudo -u postgres psql -d "$DB_NAME" -tAc 'SELECT count(*) FROM "User"' 2>/dev/null || echo 0)"
  PROJECTS="$(sudo -u postgres psql -d "$DB_NAME" -tAc 'SELECT count(*) FROM "Project"' 2>/dev/null || echo 0)"
  if [ "$NEON_USERS" != "?" ] && [ "$USERS" != "$NEON_USERS" ]; then
    echo -e "    \033[1;31mThe copy is incomplete: Neon has $NEON_USERS users, the VPS has $USERS.\033[0m See /root/neon-restore.log"
    exit 1
  fi
  ok "copied: $USERS users, $PROJECTS websites — same as Neon (download kept at $DUMP)"
else
  ok "skipped (database already has data; deploy with IMPORT_DB=1 to copy from Neon again and replace it)"
fi

step "8/11 Install, migrate and build (takes a few minutes; the site is offline while it builds)"
as_app "npm ci --no-audit --no-fund || npm install --no-audit --no-fund"
as_app "npx prisma generate"
as_app "npx prisma migrate deploy"
systemctl stop ranksignal 2>/dev/null || true
as_app "NODE_OPTIONS=--max-old-space-size=3072 npm run build"
ok "built"

step "9/11 App service (website + background jobs)"
NODE_BIN="$(command -v node)"
cat > /etc/systemd/system/ranksignal.service <<EOF
[Unit]
Description=MyWebRank (website + background job worker)
After=network-online.target postgresql.service
Wants=network-online.target postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=$NODE_BIN $APP_DIR/node_modules/next/dist/bin/next start -p $PORT -H 127.0.0.1
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=60
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable ranksignal >/dev/null 2>&1
systemctl restart ranksignal
ok "service ranksignal started"

step "10/11 Nginx, SSL and firewall"
cat > /etc/nginx/conf.d/ranksignal-upgrade.conf <<'EOF'
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
EOF
cat > /etc/nginx/sites-available/ranksignal <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    client_max_body_size 20m;

    location /.well-known/acme-challenge/ { root /var/www/html; }

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_read_timeout 300s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/ranksignal /etc/nginx/sites-enabled/ranksignal
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx && systemctl reload nginx

ufw allow OpenSSH >/dev/null
# Also whatever port this SSH session uses, so a non-standard port never locks you out.
SSH_NOW_PORT="$(echo "${SSH_CONNECTION:-}" | awk '{print $4}')"
[ -n "$SSH_NOW_PORT" ] && ufw allow "$SSH_NOW_PORT/tcp" >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ok "firewall: only SSH, HTTP and HTTPS are open"

# The site file was just rewritten, so (re)apply SSL every time; certbot re-uses an existing certificate.
{
  MAIL_ARGS=(--register-unsafely-without-email)
  [ -n "${LETSENCRYPT_EMAIL:-}" ] && MAIL_ARGS=(-m "$LETSENCRYPT_EMAIL")
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect "${MAIL_ARGS[@]}"; then
    ok "free SSL certificate for $DOMAIN (renews automatically)"
  else
    warn "Let's Encrypt failed (is $DOMAIN pointing at $PUBLIC_IP?). Using a temporary self-signed certificate."
    mkdir -p /etc/ssl/ranksignal
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 -subj "/CN=$DOMAIN" \
      -keyout /etc/ssl/ranksignal/key.pem -out /etc/ssl/ranksignal/cert.pem >/dev/null 2>&1
    sed -i "s#    listen \[::\]:80;#    listen [::]:80;\n    listen 443 ssl;\n    listen [::]:443 ssl;\n    ssl_certificate /etc/ssl/ranksignal/cert.pem;\n    ssl_certificate_key /etc/ssl/ranksignal/key.pem;#" /etc/nginx/sites-available/ranksignal
    nginx -t && systemctl reload nginx
  fi
}

step "11/11 Nightly database backups and final check"
mkdir -p "$BACKUP_DIR" && chown postgres:postgres "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
cat > /etc/cron.d/ranksignal-backup <<EOF
# Nightly backup of the MyWebRank database at 02:30, kept for 14 days.
30 2 * * * postgres pg_dump -Fc $DB_NAME > $BACKUP_DIR/$DB_NAME-\$(date +\%F).dump && find $BACKUP_DIR -name '*.dump' -mtime +14 -delete
EOF
ok "backups in $BACKUP_DIR"

echo -n "    Waiting for the app to answer"
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then echo; ok "app is up"; break; fi
  echo -n "."; sleep 2
done
curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 || { echo; warn "app not answering yet — see: journalctl -u ranksignal -n 100"; }

if [ -n "${ADMIN_EMAIL:-}" ]; then
  as_app "npm run -s make-staff -- '$ADMIN_EMAIL'" || warn "could not give admin access to $ADMIN_EMAIL"
fi

rm -rf "$BUNDLE"   # holds a copy of your keys; the server copy lives in $ENV_FILE only

cat <<EOF

$(echo -e "\033[1;32mDone.\033[0m") Your site: $APP_URL

  App folder        $APP_DIR   (settings: $ENV_FILE)
  Database          $DB_NAME on 127.0.0.1:5432, user $DB_USER, password: the one in deploy/deploy.sh
  Linux user        $APP_USER (same password)
  Backups           $BACKUP_DIR (nightly, 14 days)

  Logs              journalctl -u ranksignal -f
  Restart           systemctl restart ranksignal
  Ship new code     run the same deploy command again from your PC
EOF
