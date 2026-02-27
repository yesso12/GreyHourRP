#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/opt/greyhourrp"
BOT_ENV="/opt/greyhourrp-discord-bot/.env"
CHANNEL_MAP="/opt/greyhourrp/discord-bot/config/channel-map.json"

if [[ -f "$BOT_ENV" ]]; then
  # Load Discord creds for curl call
  # shellcheck disable=SC1090
  source "$BOT_ENV"
fi

if [[ -z "${DISCORD_TOKEN:-}" || -z "${DISCORD_GUILD_ID:-}" ]]; then
  echo "[refresh-channel-commands] Missing DISCORD_TOKEN or DISCORD_GUILD_ID in $BOT_ENV"
  exit 1
fi

echo "[refresh-channel-commands] Updating channel map..."
curl -s -H "Authorization: Bot $DISCORD_TOKEN" \
  "https://discord.com/api/v10/guilds/$DISCORD_GUILD_ID/channels" \
  > "$CHANNEL_MAP"

echo "[refresh-channel-commands] Exporting channel command map..."
DOTENV_CONFIG_PATH="$BOT_ENV" node "$ROOT_DIR/discord-bot/scripts/export-channel-commands.js"

echo "[refresh-channel-commands] Rebuilding and deploying site..."
cd "$ROOT_DIR"
npm run build
bash scripts/deploy-static.sh "$ROOT_DIR/dist" /var/www/greyhourrp

echo "[refresh-channel-commands] Done."
