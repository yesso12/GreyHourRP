# Grey Hour RP Discord Bot (Full Suite)

This bot powers advanced Discord automation for Grey Hour RP using the Admin API.

## Features
- Slash commands for status, status history, transmissions, updates, mods, lore, links, and health checks.
- Member tools: `/whois`, `/playercount`, `/serverip`.
- Member tools: `/whois`, `/playercount`, `/serverip`, `/staff`.
- Staff tools: `/poll`, `/event`, `/ticket`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/metrics`.
- Community suite: `/lfg`, `/faction`, `/trade`, `/contest`, `/raid`, `/signup`, `/mapmark`, `/safehouse`.
- Engagement suite: `/commend`, `/leaderboard`, `/squadvc`, `/survivor`, `/pz`, `/optin`, `/onboard`, `/raidmode`.
- Onboarding now supports interactive role-toggle buttons for alert opt-ins.
- Built-in per-command cooldown/rate limits reduce spam in high-traffic channels.
- Enterprise ops: structured command audit log, moderation incident tracker, and data backup/restore workflows.
- Staging mode + dry-run mode for safe production rehearsals.
- Startup config validation with explicit errors and warnings.
- Preflight validation (`npm run preflight`) for env, policy, channels, and bot permissions.
- Persistent on-disk job queue for reminders/auto-announcements.
- Structured JSON logs with per-command request IDs.
- Abuse shield (per-user + per-channel burst limiting).
- Permission policy file for command-level role gates.
- Prometheus metrics endpoint (`/metrics`) + health probe (`/healthz`).
- Backup verification and retention policy (daily + weekly).
- Ops watchdog alerts for queue backlog, scheduler failures, command error rate, and stale/failed smoke checks.
- Maintenance mode gate for non-staff commands with single-banner announcement.
- `/ops inventory` can snapshot members, roles, and channels (summary/export).
- Live moderator call workflow with button intake, SLA escalation, assignment, transfer, and closure.
- Case evidence intake (attachments/links), context packs, reporter DM updates, and quick safety actions.
- Moderator shift tracking, coverage view, and weekly moderation digest metrics.
- Admin control plane with rollback snapshots and guarded high-risk actions.
- Two-person approval flow for high-risk `/admin` actions.
- Admin-only broadcast to announcement channel.
- Auto status polling + change announcements.
- Auto updates polling + announcements.
- Auto transmissions polling + announcements.
- Auto modpack change announcements.
- Mod change diff command (`/moddiff`).
- Activity log feed from Admin API.
- Scheduled reminders with /reminder commands.
- Optional daily reminder ping.
- Optional daily metrics summary post.
- Optional welcome and goodbye messages.
- Dice rolls for events and tabletop moments.

## Setup
1. Create a Discord application + bot.
2. Copy `.env.example` to `.env` and fill values.
   - Use `.env.staging.example` or `.env.production.example` as baselines.
3. Install dependencies:
   - `npm install`
4. Run preflight checks:
   - `npm run preflight`
5. Register slash commands:
   - `npm run register`
   - `npm run register:guild`
   - `npm run register:global`
   - `npm run register:both`
6. Start bot:
   - `npm start`
7. Run smoke check:
   - `npm run smoke`
8. One-command production bootstrap (register + restart + smoke-check):
   - `npm run bootstrap:prod`

## Production Bootstrap
- Command: `npm run bootstrap:prod`
- What it does:
  - Registers slash commands.
  - Runs a canary pre-smoke check before restart.
  - Ensures `greyhourrp-discord-bot` service is enabled (safe on re-run).
  - Restarts the service and waits until it is active.
  - Runs canary post-smoke check against Admin API + service health.
- Optional env vars:
  - `SERVICE_NAME` (default `greyhourrp-discord-bot`)
  - `RESTART_TIMEOUT_SECONDS` (default `30`)

## Required env vars
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `ADMIN_API_BASE`
- `ANNOUNCE_CHANNEL_ID`
- `STATUS_CHANNEL_ID`
- `LOG_CHANNEL_ID`

## Optional env vars
- `ADMIN_BASIC_AUTH_USER` (for nginx Basic Auth protecting Admin API)
- `ADMIN_BASIC_AUTH_PASS` (for nginx Basic Auth protecting Admin API)
- `ADMIN_BASIC_AUTH_HEADER` (alternative to the two above, format: `Basic ...`)
- `ALLOWED_ROLE_IDS` (comma-separated)
- `OWNER_ROLE_IDS` (comma-separated)
- `WELCOME_CHANNEL_ID`
- `WELCOME_MESSAGE` (use `{user}` placeholder)
- `GOODBYE_CHANNEL_ID`
- `GOODBYE_MESSAGE` (use `{user}` placeholder)
- `SITE_URL` (defaults to ADMIN_API_BASE)
- `BOT_ACTIVITY_TEXT`
- `BOT_DEPLOY_TAG`
- `LORE_SNIPPET`
- `STATUS_ALERT_MENTION` (example: `@everyone`)
- `STATUS_MENTION_ONLINE`
- `STATUS_MENTION_MAINTENANCE`
- `STATUS_MENTION_OFFLINE`
- `SERVER_IP`
- `PLAYER_COUNT_API`
- `PLAYER_COUNT_LABEL`
- `TICKET_CHANNEL_ID`
- `TICKET_SUPPORT_ROLE_ID`
- `RESTART_ALERT_ROLE_ID`
- `WIPE_ALERT_ROLE_ID`
- `RAIDS_ALERT_ROLE_ID`
- `TRADE_ALERT_ROLE_ID`
- `MODCALL_CHANNEL_ID`
- `MODCALL_ROLE_ID`
- `SENIOR_MOD_ROLE_ID`
- `TRUSTED_ROLE_IDS` (comma-separated trusted roles get higher priority)
- `MODCALL_COOLDOWN_SECONDS` (default 120)
- `MODCALL_ESCALATE_MINUTES` (default 5)
- `MODCALL_ESCALATE_REPEAT_MINUTES` (default 10)
- `MODCALL_DIGEST_HOUR_UTC` (default 13)
- `MODCALL_DIGEST_WEEKDAY_UTC` (0=Sun..6=Sat, default 1)
- `RAID_MODE_MAX_MENTIONS` (default 5)
- `RAID_MODE_MIN_ACCOUNT_DAYS` (default 7)
- `AUTO_STATUS_MINUTES` (default 10)
- `AUTO_ACTIVITY_MINUTES` (default 10)
- `AUTO_UPDATES_MINUTES` (default 30)
- `AUTO_TRANSMISSIONS_MINUTES` (default 30)
- `AUTO_MODS_MINUTES` (default 60)
- `DAILY_REMINDER_TIME` (HH:MM)
- `DAILY_REMINDER_MESSAGE`
- `DAILY_REMINDER_CHANNEL_ID`
- `DAILY_SUMMARY_TIME` (HH:MM)
- `DAILY_SUMMARY_CHANNEL_ID`
- `STAGING_MODE` (true/false)
- `DRY_RUN_MODE` (true/false)
- `METRICS_PORT` (set to enable Prometheus endpoint)
- `METRICS_HOST` (default `127.0.0.1`)
- `ABUSE_WINDOW_SECONDS` (default 30)
- `ABUSE_USER_MAX_COMMANDS` (default 12)
- `ABUSE_CHANNEL_MAX_COMMANDS` (default 40)
- `JOB_WORKER_INTERVAL_SECONDS` (default 5)
- `BACKUP_RETENTION_DAILY` (default 14)
- `BACKUP_RETENTION_WEEKLY` (default 8)
- `PERMISSION_POLICY_FILE` (default `config/permissions-policy.json`)
- `ALERT_CHANNEL_ID` (defaults to `LOG_CHANNEL_ID` then `ANNOUNCE_CHANNEL_ID`)
- `QUEUE_BACKLOG_ALERT_THRESHOLD` (default 50)
- `COMMAND_ERROR_RATE_THRESHOLD` (default 0.25)
- `SMOKE_STATUS_MAX_AGE_MINUTES` (default 30)
- `AUDIT_RETENTION_DAYS` (default 30)
- `INCIDENT_RETENTION_DAYS` (default 180)
- `REGISTER_SCOPE` (`guild`, `global`, `both`)
- `ADMIN_REQUIRE_SECOND_CONFIRMATION` (default true)

## Commands
- `/ping`
- `/help`
- `/health`
- `/ops status|maintenance|inventory`
- `/modcall setup|create|list|claim|transfer|close|status|evidence|flag`
- `/mod shift|coverage|metrics`
- `/admin purge|lockdown|unlockdown|rolegrant|rolerevoke|snapshot|rollback`
- `/metrics`
- `/audit list`
- `/audit export`
- `/incident create|list|resolve`
- `/backup create|list|restore`
- `/lfg create|list|close`
- `/faction create|recruit|roster|disband`
- `/trade post|list|close`
- `/contest start|vote|end`
- `/raid create|list|end`
- `/signup join|leave|list`
- `/mapmark add|list|remove`
- `/safehouse request|review|list`
- `/commend user reason`
- `/leaderboard`
- `/squadvc create|close`
- `/optin type`
- `/onboard post`
- `/raidmode state`
- `/survivor tip|challenge`
- `/pz trait|recipe|infection|skill`
- `/whois`
- `/playercount`
- `/serverip`
- `/staff`
- `/links`
- `/lore`
- `/status`
- `/statushistory`
- `/updates`
- `/transmissions`
- `/mods`
- `/moddiff`
- `/rules`
- `/join`
- `/announce message everyone`
- `/poll question`
- `/event create|list|announce|end`
- `/ticket create|close`
- `/reminder add minutes message`
- `/reminder list`
- `/reminder remove id`
- `/purge amount`
- `/slowmode seconds`
- `/lock`
- `/unlock`
- `/roll sides count`
- `/activity`

## Notes
- The bot uses Admin API endpoints and respects existing role permissions.
- Keep the API protected behind nginx/basic-auth credentials and strict role mapping.
- Smoke check validates Admin API auth + service state: `npm run smoke`
- Policy file is evaluated on every staff command gate (`/backup`, `/audit`, `/incident`, `/ops`, etc.).
- Bot admin API calls include a request correlation header (`X-Request-ID`) for tracing.
