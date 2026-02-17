# Host Operations Guide (Game VPS + Admin API)

This guide captures what must be done with host-level access for ongoing upgrades.
It is written so a VPS owner, host support, or panel admin can execute without context.

## Summary
- RCON can control gameplay, but **cannot** run SteamCMD or update Workshop files.
- Any feature that touches the filesystem, services, or SteamCMD requires OS-level access.
- The admin API is designed to call a "game bridge" for host-level operations.

## Features That Require Host Access
- Workshop updates (SteamCMD)
- Installing or restarting host services (systemd)
- Reading host logs outside the game console
- Updating server binaries
- Scheduled tasks or cron jobs

## Host Automation Timers (Recommended)
Use repo-managed systemd units instead of ad-hoc cron entries.

Files:
- `scripts/systemd/greyhourrp-self-heal.service`
- `scripts/systemd/greyhourrp-self-heal.timer`
- `scripts/systemd/greyhourrp-health-check.service`
- `scripts/systemd/greyhourrp-health-check.timer`
- `scripts/systemd/greyhourrp-content-backup.service`
- `scripts/systemd/greyhourrp-content-backup.timer`
- `scripts/systemd/greyhourrp-restore-drill.service`
- `scripts/systemd/greyhourrp-restore-drill.timer`
- `scripts/systemd/greyhourrp-rotate-secrets.service`
- `scripts/systemd/greyhourrp-rotate-secrets.timer`
- `scripts/systemd/greyhourrp-service-guard.service`
- `scripts/systemd/greyhourrp-service-guard.timer`
- `scripts/systemd/greyhourrp-integrity-check.service`
- `scripts/systemd/greyhourrp-integrity-check.timer`
- Installer: `scripts/systemd/install-host-automation.sh`

Install:
```bash
cd /opt/greyhourrp
sudo bash scripts/systemd/install-host-automation.sh
```

Enable daily backup timer too:
```bash
cd /opt/greyhourrp
sudo ENABLE_BACKUP_TIMER=true bash scripts/systemd/install-host-automation.sh
```

Enable restore drill timer too:
```bash
cd /opt/greyhourrp
sudo ENABLE_BACKUP_TIMER=true ENABLE_RESTORE_DRILL_TIMER=true bash scripts/systemd/install-host-automation.sh
```

Enable secrets rotation timer too:
```bash
cd /opt/greyhourrp
sudo ENABLE_BACKUP_TIMER=true ENABLE_RESTORE_DRILL_TIMER=true ENABLE_SECRET_ROTATION_TIMER=true ENABLE_SERVICE_GUARD_TIMER=true ENABLE_INTEGRITY_TIMER=true bash scripts/systemd/install-host-automation.sh
```

Env overrides:
- Copy `scripts/systemd/greyhourrp-automation.env.example`
- Host path: `/etc/default/greyhourrp-automation`
- Set `AUTOMATION_ALERT_WEBHOOK_URL` to enable Discord alerts for timer success/failure.
- Webhook circuit-breaker controls:
  - `AUTOMATION_ALERT_WEBHOOK_DISABLE_AFTER_FAILS=3`
  - `AUTOMATION_ALERT_WEBHOOK_DISABLE_SECONDS=3600`
  - `AUTOMATION_ALERT_WEBHOOK_PROBE_INTERVAL_SECONDS=300`
  - `AUTOMATION_ALERT_STATE_DIR=/var/lib/greyhourrp-automation-alerts`
- Optional fallback if webhook is invalid:
  - `AUTOMATION_ALERT_CHANNEL_ID=<channel-id>`
  - `AUTOMATION_DISCORD_TOKEN=<bot-token>` or `AUTOMATION_DISCORD_TOKEN_FILE=/opt/greyhourrp-discord-bot/.env`
  - `AUTOMATION_ALERT_CHANNEL_KEY=LOG_CHANNEL_ID` (or other channel key in token file)
- Secrets rotation config:
  - `ADMIN_API_ENV_PATH=/etc/greyhourrp-admin-api.env`
  - `BOT_ENV_PATHS=/opt/greyhourrp/discord-bot/.env:/opt/greyhourrp-discord-bot/.env`
  - `SECRET_ROTATE_MIN_LENGTH=40`
  - `SECRET_ROTATE_DRY_RUN=false`
- Service guard config:
  - `WATCH_SERVICES=\"greyhourrp-admin-api greyhourrp-discord-bot\"`
  - `RESTART_COOLDOWN_SECONDS=300`
  - `SERVICE_GUARD_STATE_DIR=/var/lib/greyhourrp-service-guard`
- Integrity config:
  - `QUARANTINE_ROOT=/var/backups/greyhourrp/quarantine`
  - `ENABLE_AUTO_RESTORE_ON_CORRUPTION=true`
  - `CONTENT_SCAN_MAXDEPTH=1`
- If Discord bot automation should be disabled on this host:
  - `SELF_HEAL_DEPLOY_BOT=false`
  - `CHECK_DISCORD_BOT_SERVICE=false`
  - `RUN_BOT_SMOKE_CHECK=false`

## Features That Can Be Done With RCON
- Check server online status
- Restart (via `quit` + service restart if handled by supervisor)
- Send announcements
- Run game commands

## Game Bridge Overview
The bridge is a tiny HTTP server on the game VPS.

Endpoints:
- `GET /control/status`
- `POST /control/restart`
- `POST /control/announce`
- `POST /control/command`
- `POST /control/workshop-update`

Auth:
- `Authorization: Bearer <GREYHOURRP_GAME_CONTROL_TOKEN>`

## Install the Bridge (Game VPS)
Prereqs:
- Python 3
- systemd
- SteamCMD installed

Files needed on the game VPS:
- `install-game-bridge.sh`
- `workshop-update.sh`

Example install command (edit values as needed):
```bash
chmod +x /path/install-game-bridge.sh /path/workshop-update.sh

sudo env \
  GREYHOURRP_GAME_CONTROL_TOKEN="<token>" \
  GAME_SERVICE_NAME="zomboid.service" \
  WORKSHOP_UPDATE_SCRIPT="/path/workshop-update.sh" \
  STEAMCMD_PATH="/steamcmd/steamcmd.sh" \
  GAME_APP_ID="380870" \
  WORKSHOP_APP_ID="108600" \
  SERVER_INI="/.cache/Server/legionhosting2.ini" \
  bash /path/install-game-bridge.sh
```

Validate:
```bash
sudo systemctl status greyhourrp-game-bridge.service --no-pager
curl -s -H "Authorization: Bearer <token>" http://127.0.0.1:8787/control/status
```

## Admin API Configuration (API VPS)
The admin API must be told where the bridge lives.

Set these in `/etc/greyhourrp-admin-api.env`:
```
GREYHOURRP_GAME_CONTROL_URL=http://<GAME_VPS_IP>:8787
GREYHOURRP_GAME_CONTROL_TOKEN=<token>
```

Restart:
```bash
sudo systemctl restart greyhourrp-admin-api
```

## Workshop Update Script
The bridge calls a local script to run SteamCMD updates.

Script: `scripts/game-vps/workshop-update.sh`

Inputs:
- `STEAMCMD_PATH`: path to `steamcmd.sh`
- `GAME_APP_ID`: PZ dedicated server app id (380870)
- `WORKSHOP_APP_ID`: PZ workshop app id (108600)
- `SERVER_INI`: used to parse `WorkshopItems=`
- Optional `WORKSHOP_IDS`: semicolon list if you do not want to parse the INI

## Hosting Panel Alternatives (No SSH)
If SSH is not available, look for one of these in your provider panel:
- Host console terminal (OS shell, not the game console)
- Startup script
- Scheduled task / cron

If the host uses a Pterodactyl-based panel, you can also restart via the panel API
from the admin API (no SSH required).

Panel API env vars:
```
GREYHOURRP_PANEL_URL=https://<PANEL_HOST>
GREYHOURRP_PANEL_API_KEY=<client_api_key>
GREYHOURRP_PANEL_SERVER_ID=<server_identifier>
```

## Ops Config (Automation)
The admin UI exposes an `ops-config` JSON file that controls automation features:
- Scheduled restarts
- Auto-restart on Workshop mismatch
- Panel health checks
- Player history retention

Default file: `ops-config.json` in the content root.

Example keys:
- `schedule.enabled`, `schedule.time`, `schedule.daysOfWeek`, `schedule.announceMinutes`
- `autoRestartOnWorkshopMismatch`, `mismatchRegex`, `autoRestartCooldownMinutes`
- `panelHealth.enabled`, `panelHealth.intervalSeconds`
- `maintenance.enabled`, `maintenance.message`, `maintenance.autoMuteAlerts`
- `playerHistoryMax`
- `discordAlerts.webhookUrl`, `discordAlerts.mentionEveryone`
- `dailySummary.enabled`, `dailySummary.time`, `dailySummary.includeCsv`
- `discordAlerts.minIntervalMinutes`, `discordAlerts.quietHours`
- `weeklySummary.enabled`, `weeklySummary.dayOfWeek`, `weeklySummary.includeCsv`
- `exportSchedule.enabled`, `exportSchedule.cadence`, `exportSchedule.hours`
- `discordAlerts.categories.panelHealth|restarts|mismatches|schedule|summary`

Update via the admin UI or through the admin API:
```
GET  /api/admin/content/ops-config
PUT  /api/admin/content/ops-config
```

## Panel Backups (API)
If your host panel is Pterodactyl-based, the admin API can list and create backups:
```
GET  /api/admin/game/panel/backups
POST /api/admin/game/panel/backups
GET  /api/admin/game/panel/backups/{backupId}/download
```

## Player History
Player history is collected during autosync and stored in `player-history.json`.
Fetch from:
```
GET /api/admin/game/players-history?limit=500
```

CSV export:
```
GET /api/admin/game/players-history.csv?limit=2000&hours=24
```

## Daily Ops Summary
If enabled, sends a daily summary of player counts and ops activity to your ops alerts webhook.
Configure in `ops-config`:
```
dailySummary.enabled = true
dailySummary.time = "20:00"
dailySummary.includeCsv = false
dailySummary.includeOpsCounts = true
dailySummary.includeMismatchCounts = true
dailySummary.onlyIfData = true
```

## Weekly Ops Summary
```
weeklySummary.enabled = true
weeklySummary.dayOfWeek = "sun"
weeklySummary.time = "20:00"
weeklySummary.includeCsv = false
weeklySummary.onlyIfData = true
```

## Export Schedule (CSV)
Automatically posts CSV exports to the ops webhook.
```
exportSchedule.enabled = true
exportSchedule.cadence = "daily" # or "weekly"
exportSchedule.time = "21:00"
exportSchedule.dayOfWeek = "sun"
exportSchedule.hours = 24
exportSchedule.limit = 2000
exportSchedule.message = "Scheduled CSV export."
```

## Alert Quiet Hours (Anti-Noise)
Use these settings to keep the bot quiet during certain hours:
```
discordAlerts.minIntervalMinutes = 15
discordAlerts.quietHours.enabled = true
discordAlerts.quietHours.start = "00:00"
discordAlerts.quietHours.end = "06:00"
```

## Ops Alerts Routing
Set `discordAlerts.webhookUrl` in ops-config to route ops alerts to a different channel or Slack webhook.
If the URL contains `hooks.slack.com`, alerts are sent as Slack messages.

Any of those can run the install command above.

## Upgrade Checklist (Future Features)
Use this list when adding new game-server features:
1. Decide if the feature is RCON-only or host-level.
2. If host-level, add a new bridge endpoint and script.
3. Add a matching admin API endpoint.
4. Add an admin panel button or control for it.
5. Document new env vars in this file.
6. Verify firewall allows the bridge port (default `8787`) from the API VPS.
7. Test the bridge endpoint directly with `curl`.

## Support Request Template
If you must contact hosting support, send this:
```
Please run these commands on the game VPS host:

chmod +x /path/install-game-bridge.sh /path/workshop-update.sh
sudo env \
  GREYHOURRP_GAME_CONTROL_TOKEN="<token>" \
  GAME_SERVICE_NAME="zomboid.service" \
  WORKSHOP_UPDATE_SCRIPT="/path/workshop-update.sh" \
  STEAMCMD_PATH="/steamcmd/steamcmd.sh" \
  GAME_APP_ID="380870" \
  WORKSHOP_APP_ID="108600" \
  SERVER_INI="/.cache/Server/legionhosting2.ini" \
  bash /path/install-game-bridge.sh

Then verify:
sudo systemctl status greyhourrp-game-bridge.service --no-pager
```
