# Grey Hour RP Discord Bot (Full Suite)

This bot powers advanced Discord automation for Grey Hour RP using the Admin API.

## Features
- Slash commands for status, status history, transmissions, updates, mods, lore, and links.
- Admin-only broadcast to announcement channel.
- Auto status polling + change announcements.
- Auto updates polling + announcements.
- Auto transmissions polling + announcements.
- Auto modpack change announcements.
- Activity log feed from Admin API.
- Scheduled reminders with /reminder commands.
- Optional daily reminder ping.
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
- `AUTO_STATUS_MINUTES` (default 10)
- `AUTO_ACTIVITY_MINUTES` (default 10)
- `AUTO_UPDATES_MINUTES` (default 30)
- `AUTO_TRANSMISSIONS_MINUTES` (default 30)
- `AUTO_MODS_MINUTES` (default 60)
- `DAILY_REMINDER_TIME` (HH:MM)
- `DAILY_REMINDER_MESSAGE`
- `DAILY_REMINDER_CHANNEL_ID`

## Commands
- `/ping`
- `/help`
- `/links`
- `/lore`
- `/status`
- `/statushistory`
- `/updates`
- `/transmissions`
- `/mods`
- `/rules`
- `/join`
- `/announce message everyone`
- `/reminder add minutes message`
- `/reminder list`
- `/reminder remove id`
- `/roll sides count`
- `/activity`

## Notes
- The bot uses Admin API endpoints and respects existing role permissions.
- Keep the API protected behind nginx basic auth and a strong API key.
