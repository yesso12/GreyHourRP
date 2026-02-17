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
- Deploy workflow: `.github/workflows/deploy-static.yml`
- Static deploy script: `scripts/deploy-static.sh`
- Static rollback script: `scripts/rollback-static.sh`
- Host automation installer: `scripts/systemd/install-host-automation.sh`
  - Installs systemd timers/services for self-heal and health checks.
  - Optional daily backup timer (off by default, enable with `ENABLE_BACKUP_TIMER=true`).

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

Automation env overrides:
- Example file: `scripts/systemd/greyhourrp-automation.env.example`
- Host location: `/etc/default/greyhourrp-automation`
- If the Discord bot is hosted elsewhere, set:
  - `SELF_HEAL_DEPLOY_BOT=false`
  - `CHECK_DISCORD_BOT_SERVICE=false`
  - `RUN_BOT_SMOKE_CHECK=false`

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
