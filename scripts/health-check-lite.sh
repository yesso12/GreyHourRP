#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CHECK_ADMIN_API_SERVICE="${CHECK_ADMIN_API_SERVICE:-true}"
CHECK_DISCORD_BOT_SERVICE="${CHECK_DISCORD_BOT_SERVICE:-true}"
ADMIN_API_SERVICE_NAME="${ADMIN_API_SERVICE_NAME:-greyhourrp-admin-api}"
DISCORD_BOT_SERVICE_NAME="${DISCORD_BOT_SERVICE_NAME:-greyhourrp-discord-bot}"
ADMIN_API_ENV_PATH="${ADMIN_API_ENV_PATH:-/etc/greyhourrp-admin-api.env}"
BOT_ENV_PATHS="${BOT_ENV_PATHS:-$ROOT_DIR/discord-bot/.env:/opt/greyhourrp-discord-bot/.env}"

is_true() {
  [[ "${1,,}" == "1" || "${1,,}" == "true" || "${1,,}" == "yes" ]]
}

find_bot_env() {
  IFS=':' read -r -a candidates <<< "$BOT_ENV_PATHS"
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

bot_env_file="$(find_bot_env)"
if [[ -z "$bot_env_file" ]]; then
  echo "[lite] missing bot env file (checked: ${BOT_ENV_PATHS})"
  exit 1
fi

use_service_check() {
  local svc="$1"
  local name="$2"
  if systemctl is-active --quiet "$svc" 2>/dev/null || sudo systemctl is-active --quiet "$svc"; then
    echo "[lite] $name: active"
  else
    echo "[lite] $name: NOT active"
    exit 1
  fi
}

if is_true "$CHECK_ADMIN_API_SERVICE"; then
  use_service_check "$ADMIN_API_SERVICE_NAME" "$ADMIN_API_SERVICE_NAME"
else
  echo "[lite] $ADMIN_API_SERVICE_NAME: skipped by CHECK_ADMIN_API_SERVICE=$CHECK_ADMIN_API_SERVICE"
fi

if is_true "$CHECK_DISCORD_BOT_SERVICE"; then
  use_service_check "$DISCORD_BOT_SERVICE_NAME" "$DISCORD_BOT_SERVICE_NAME"
else
  echo "[lite] $DISCORD_BOT_SERVICE_NAME: skipped by CHECK_DISCORD_BOT_SERVICE=$CHECK_DISCORD_BOT_SERVICE"
fi

if [[ -f "$bot_env_file" ]]; then
  set -a
  source "$bot_env_file"
  set +a
fi

: "${ADMIN_API_BASE:?ADMIN_API_BASE is required from the bot env file}"

API_URL="${ADMIN_API_BASE%/}/api/admin/content/server-status"
CURL_ARGS=(
  --silent
  --show-error
  --location
  --output /tmp/greyhourrp-api-health.json
  --write-out "%{http_code}"
)

if [[ -n "${ADMIN_BASIC_AUTH_HEADER:-}" ]]; then
  CURL_ARGS+=(--header "Authorization: ${ADMIN_BASIC_AUTH_HEADER}")
elif [[ -n "${ADMIN_BASIC_AUTH_USER:-}" && -n "${ADMIN_BASIC_AUTH_PASS:-}" ]]; then
  CURL_ARGS+=(--user "${ADMIN_BASIC_AUTH_USER}:${ADMIN_BASIC_AUTH_PASS}")
fi

status_code="$(curl "${CURL_ARGS[@]}" "${API_URL}")"
if [[ "$status_code" != "200" ]]; then
  echo "[lite] api check failed: HTTP $status_code"
  cat /tmp/greyhourrp-api-health.json
  exit 1
fi

echo "[lite] api endpoint: PASS (${API_URL})"
echo "[lite] response:"
cat /tmp/greyhourrp-api-health.json

echo "[lite] ALL CHECKS PASSED"
