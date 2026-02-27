# Grey Hour RP — Website

Professional cinematic site for the Grey Hour RP Project Zomboid server.

## Tech
- Vite + React + TypeScript
- Framer Motion animations
- Zero-backend admin content via JSON in `public/content/`

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
Output goes to `dist/`.

## Environment
- `.env.staging.example`
- `.env.production.example`

Optional telemetry:
- `VITE_OBSERVABILITY_ENDPOINT=https://your-endpoint/api/telemetry`

Optional live API contracts (public pages):
- `VITE_LIVE_API_BASE=https://your-domain`
- `VITE_LIVE_SNAPSHOT_PATH=/api/public/live-snapshot`
- `VITE_PUBLIC_GAME_PATH=/api/public/game/telemetry`
- `VITE_PUBLIC_DISCORD_PATH=/api/public/discord/status`
- `VITE_PUBLIC_INTEGRATION_PATH=/api/public/integration/readiness`
Note: each `VITE_PUBLIC_*_PATH` (and `VITE_LIVE_SNAPSHOT_PATH`) can be a full `https://` URL if the game/discord services live on different hosts.

Optional OIDC SSO (frontend):
- `VITE_OIDC_ISSUER`
- `VITE_OIDC_CLIENT_ID`
- `VITE_OIDC_REDIRECT_URI` (default: `https://<domain>/admin/login`)
- `VITE_OIDC_SCOPE` (default: `openid profile email`)

## Content (admin friendly)
Edit these JSON files:
- `public/content/server-status.json` (online/maintenance/offline)
- `public/content/transmissions.json` (living "Transmission Intercepted")
- `public/content/updates.json` (changelog)
- `public/content/mods.json` (modpack list)
- `public/content/rules.json` (rules)
- `public/content/staff.json` (staff)
- `public/content/factions-territory.json` (factions + map control)
- `public/content/player-dossiers.json` (character dossiers + reputation)
- `public/content/story-arcs.json` (seasonal arcs + phases)
- `public/content/event-calendar.json` (events schedule)
- `public/content/economy-snapshot.json` (market pulse)
- `public/content/helpline-scripts.json` (staff/owner helpline scripts)
- `public/content/discord-ops.json` (discord quiet hours + digest)
- `public/content/faction-channels.json` (discord faction routing)

Then rebuild + redeploy.

## Optional ambient audio
Place a file at:
- `public/audio/ambient.mp3`

The navbar toggle will enable it (if file exists).

## Deploy to an IONOS VPS (Nginx)
1) Build on the VPS or locally:
```bash
npm ci
npm run build
```

2) Copy the `dist/` folder to your web root, e.g.
- `/var/www/greyhourrp`

3) Nginx config example (see below).

### Nginx config (static SPA + caching)
Create: `/etc/nginx/sites-available/greyhourrp`
```nginx
server {
  server_name YOUR_DOMAIN_HERE;

  root /var/www/greyhourrp;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location /content/ {
    add_header Cache-Control "no-store";
  }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/greyhourrp /etc/nginx/sites-enabled/greyhourrp
sudo nginx -t
sudo systemctl reload nginx
```

### SSL (recommended)
Use certbot (Debian/Ubuntu):
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN_HERE
```

## Enterprise Ops
- CI workflow: `.github/workflows/ci.yml`
- Security workflow: `.github/workflows/security.yml`
- Secrets scan workflow: `.github/workflows/secrets-scan.yml`
- Deploy workflow: `.github/workflows/deploy-static.yml`
- Synthetic monitoring workflow: `.github/workflows/synthetic-monitor.yml`
- Static deploy script: `scripts/deploy-static.sh`
- Static rollback script: `scripts/rollback-static.sh`
- Canary promote script: `scripts/canary-promote.sh`
- SLO rollback guard script: `scripts/slo-rollback.sh`
- Policy gate script: `scripts/policy-gate.sh`
- Drift detection script: `scripts/drift-detect.sh`
- Provenance script: `scripts/provenance.sh`
- RUM rollup script: `scripts/rum-rollup.sh`
- Unified ops board script: `scripts/ops-board-build.sh`
- Backup verification script: `scripts/backup-verify.sh`
- Queue worker: `scripts/queue-worker.mjs`
- Host automation installer: `scripts/systemd/install-host-automation.sh`
  - Installs systemd timers/services for self-heal and health checks.
  - Optional daily backup timer (off by default, enable with `ENABLE_BACKUP_TIMER=true`).
  - Optional weekly restore-drill timer (off by default, enable with `ENABLE_RESTORE_DRILL_TIMER=true`).
  - Optional monthly secrets-rotation timer (off by default, enable with `ENABLE_SECRET_ROTATION_TIMER=true`).
- Service-guard timer (on by default, disable with `ENABLE_SERVICE_GUARD_TIMER=false`).
- Integrity-check timer (on by default, disable with `ENABLE_INTEGRITY_TIMER=false`).
- SLO guard timer (on by default, disable with `ENABLE_SLO_GUARD_TIMER=false`).
- Drift detection timer (on by default, disable with `ENABLE_DRIFT_TIMER=false`).
- RUM rollup timer (on by default, disable with `ENABLE_RUM_TIMER=false`).
- Ops board timer (on by default, disable with `ENABLE_OPS_BOARD_TIMER=false`).
- Autoscale policy timer (on by default, disable with `ENABLE_AUTOSCALE_TIMER=false`).
- Queue worker service (on by default, disable with `ENABLE_QUEUE_WORKER_SERVICE=false`).
- Backup verification timer (off by default, enable with `ENABLE_BACKUP_VERIFY_TIMER=true`).

Install timers on host:
```bash
cd /opt/greyhourrp
sudo bash scripts/systemd/install-host-automation.sh
```

Enable backup timer too:
```bash
cd /opt/greyhourrp
sudo ENABLE_BACKUP_TIMER=true bash scripts/systemd/install-host-automation.sh
```

Enable backup + restore-drill timers:
```bash
cd /opt/greyhourrp
sudo ENABLE_BACKUP_TIMER=true ENABLE_RESTORE_DRILL_TIMER=true bash scripts/systemd/install-host-automation.sh
```

Enable all timers (backup + restore drill + secrets rotation):
```bash
cd /opt/greyhourrp
sudo ENABLE_BACKUP_TIMER=true ENABLE_RESTORE_DRILL_TIMER=true ENABLE_SECRET_ROTATION_TIMER=true ENABLE_SERVICE_GUARD_TIMER=true ENABLE_INTEGRITY_TIMER=true bash scripts/systemd/install-host-automation.sh
```

Automation env overrides:
- Example file: `scripts/systemd/greyhourrp-automation.env.example`
- Host location: `/etc/default/greyhourrp-automation`
- Set `AUTOMATION_ALERT_WEBHOOK_URL` to receive success/failure timer summaries (with recent log tail).
- Webhook circuit-breaker controls:
  - `AUTOMATION_ALERT_WEBHOOK_DISABLE_AFTER_FAILS=3`
  - `AUTOMATION_ALERT_WEBHOOK_DISABLE_SECONDS=3600`
  - `AUTOMATION_ALERT_WEBHOOK_PROBE_INTERVAL_SECONDS=300`
  - `AUTOMATION_ALERT_STATE_DIR=/var/lib/greyhourrp-automation-alerts`
- If webhook fails/unavailable, alerting can fallback to Discord Bot API using:
  - `AUTOMATION_ALERT_CHANNEL_ID` (or channel from `AUTOMATION_ALERT_CHANNEL_KEY`)
  - `AUTOMATION_DISCORD_TOKEN` or `AUTOMATION_DISCORD_TOKEN_FILE`
- If the Discord bot is hosted elsewhere, set:
  - `SELF_HEAL_DEPLOY_BOT=false`
  - `CHECK_DISCORD_BOT_SERVICE=false`
  - `RUN_BOT_SMOKE_CHECK=false`
- Restore drill settings:
  - `RESTORE_DRILL_ROOT=/tmp/greyhourrp-restore-drill`
  - `RESTORE_DRILL_KEEP_LATEST=3`
- Secrets rotation settings:
  - `ADMIN_API_ENV_PATH=/etc/greyhourrp-admin-api.env`
  - `BOT_ENV_PATHS=/opt/greyhourrp/discord-bot/.env:/opt/greyhourrp-discord-bot/.env`
  - `SECRET_ROTATE_MIN_LENGTH=40`
  - `SECRET_ROTATE_DRY_RUN=false`
- Service guard settings:
  - `WATCH_SERVICES="greyhourrp-admin-api greyhourrp-discord-bot"`
  - `RESTART_COOLDOWN_SECONDS=300`
  - `SERVICE_GUARD_STATE_DIR=/var/lib/greyhourrp-service-guard`
- Integrity settings:
  - `QUARANTINE_ROOT=/var/backups/greyhourrp/quarantine`
  - `ENABLE_AUTO_RESTORE_ON_CORRUPTION=true`
  - `CONTENT_SCAN_MAXDEPTH=1`

Synthetic monitor secrets (GitHub Actions):
- `PUBLIC_BASE_URL` (optional; defaults to `https://greyhourrp.xyz`)
- `ADMIN_API_BASE` (optional; defaults to `PUBLIC_BASE_URL`)
- `ADMIN_BASIC_AUTH_HEADER` or `ADMIN_BASIC_AUTH_USER` + `ADMIN_BASIC_AUTH_PASS` (optional admin checks)
- `BOT_METRICS_URL` (optional bot metrics endpoint check)
- `SYNTHETIC_ALERT_WEBHOOK_URL` (optional failure alert destination)

Advanced automation map (items 1-15):
- `docs/ops/advanced-automation.md`

## Game Ops
- Host operations guide: `docs/ops/host-ops.md`
- SLOs: `docs/enterprise/slo.md`
- Incident runbook: `docs/enterprise/incident-response.md`
- DR runbook: `docs/enterprise/disaster-recovery.md`
- Access policy: `docs/enterprise/access-control.md`
- Release process: `docs/enterprise/release-management.md`

## Admin API OIDC Mode
Configure `/etc/greyhourrp-admin-api.env`:
- `GREYHOURRP_AUTH_MODE=hybrid` (`basic`, `oidc`, or `hybrid`)
- `GREYHOURRP_OIDC_AUTHORITY=https://<issuer>`
- `GREYHOURRP_OIDC_AUDIENCE=<api-audience>`
- `GREYHOURRP_OIDC_USER_CLAIM=preferred_username`
- `GREYHOURRP_OIDC_ROLE_CLAIM=role`
- `GREYHOURRP_OIDC_REQUIRE_HTTPS=true`

Then restart:
```bash
sudo systemctl restart greyhourrp-admin-api
```
