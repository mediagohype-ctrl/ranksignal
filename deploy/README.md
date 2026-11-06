# Deploy to the Hostinger VPS

One command, run from this project folder on your PC (Git Bash):

```bash
bash deploy/deploy.sh <VPS_IP>                                 # no domain yet → https://<ip-with-dashes>.sslip.io
bash deploy/deploy.sh <VPS_IP> yourdomain.com                  # with your domain (point its A record at the VPS first)
bash deploy/deploy.sh <VPS_IP> yourdomain.com you@email.com    # also gives that account admin access
```

It asks for the VPS root password twice (upload, then setup). The first run takes 10–15 minutes.

## What it sets up (all on the one VPS)

| Part | Where |
|---|---|
| Website + background jobs | systemd service `ranksignal` (Next.js on 127.0.0.1:3000) |
| Code | `/var/www/ranksignal` (runs as Linux user `ranksignal`) |
| Settings | `/var/www/ranksignal/.env`, made from your PC's `.env` on the first run |
| Database | PostgreSQL, database `ranksignal`, user `ranksignal`, local connections only |
| Your data | copied from Neon on the first run (Neon itself is only read, never changed) |
| Web server | Nginx with free SSL (Let's Encrypt, renews by itself) |
| Firewall | only SSH, HTTP and HTTPS open |
| Backups | nightly at 02:30 in `/var/backups/ranksignal`, kept 14 days |

The password for the database and the `ranksignal` Linux user is set at the top of `deploy/deploy.sh`
(`APP_PASSWORD`). Change it there and run the deploy again to change it on the server.

## Later

- **New code:** commit, then run the same command again. The server's `.env` and database are kept.
- **Change keys** (Razorpay, Turnstile, email…): `bash deploy/set-env.sh <VPS_IP> KEY=value KEY2=value2` (sets them on
  the server and restarts the app; nothing is saved in git). Or edit `/var/www/ranksignal/.env` on the server, then
  `systemctl restart ranksignal`. Or update your PC's `.env` and deploy with `REFRESH_ENV=1 bash deploy/deploy.sh …`.
- **Copy Neon data again** (replaces the VPS data): `IMPORT_DB=1 bash deploy/deploy.sh …`
- **SSL notice email:** `LETSENCRYPT_EMAIL=you@email.com bash deploy/deploy.sh …`
- **Logs:** `journalctl -u ranksignal -f` · **Restart:** `systemctl restart ranksignal`
- **Switching to your domain:** point the domain's A record at the VPS IP, then
  `bash deploy/deploy.sh <VPS_IP> yourdomain.com`. Also update the Razorpay webhook URL and the Google sign-in
  redirect (`https://yourdomain.com/api/auth/google/callback`).

When the VPS is live, stop the old Render service so two copies don't run background jobs at the same time.
