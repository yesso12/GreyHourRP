# Grey Hour RP Discord Bot (Full Suite)

This bot powers advanced Discord automation for Grey Hour RP using the Admin API.

## Features
- Slash commands for status, status history, transmissions, updates, mods, lore, links, and health checks.
- Member tools: `/whois`, `/playercount`, `/serverip`.
- Staff tools: `/poll`, `/event`, `/ticket`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/metrics`.
- Community suite: `/lfg`, `/faction`, `/trade`, `/contest`, `/raid`, `/signup`, `/mapmark`, `/safehouse`.
- Engagement suite: `/commend`, `/leaderboard`, `/squadvc`, `/survivor`, `/pz`, `/optin`, `/onboard`, `/raidmode`.
- Onboarding now supports interactive role-toggle buttons for alert opt-ins.
- Built-in per-command cooldown/rate limits reduce spam in high-traffic channels.
- Enterprise ops: structured command audit log, moderation incident tracker, and data backup/restore workflows.
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
3. Install dependencies:
   - `npm install`
4. Register slash commands (guild-scoped):
   - `npm run register`
5. Start bot:
   - `npm start`
6. Run smoke check:
   - `npm run smoke`

## Required env vars
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `ADMIN_API_BASE`
- `ADMIN_API_KEY`
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

## Commands
- `/ping`
- `/help`
- `/health`
- `/metrics`
- `/audit list`
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
- Keep the API protected behind nginx basic auth and a strong API key.
- Smoke check validates Admin API auth + service state: `npm run smoke`
