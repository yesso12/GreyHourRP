#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CHECK_ADMIN_API_SERVICE="${CHECK_ADMIN_API_SERVICE:-true}"
CHECK_DISCORD_BOT_SERVICE="${CHECK_DISCORD_BOT_SERVICE:-true}"
RUN_BOT_SMOKE_CHECK="${RUN_BOT_SMOKE_CHECK:-true}"
ADMIN_API_SERVICE_NAME="${ADMIN_API_SERVICE_NAME:-greyhourrp-admin-api}"
DISCORD_BOT_SERVICE_NAME="${DISCORD_BOT_SERVICE_NAME:-greyhourrp-discord-bot}"
ADMIN_API_ENV_PATH="${ADMIN_API_ENV_PATH:-/etc/greyhourrp-admin-api.env}"
BOT_ENV_PATHS="${BOT_ENV_PATHS:-$ROOT_DIR/discord-bot/.env:/opt/greyhourrp-discord-bot/.env}"

is_true() {
  [[ "${1,,}" == "1" || "${1,,}" == "true" || "${1,,}" == "yes" ]]
}

assert_env_key_nonempty() {
  local file="$1"
  local key="$2"
  local value
  value="$(sed -n "s/^${key}=//p" "$file" | tail -n 1 || true)"
  if [[ -z "$value" ]]; then
    echo "[full] missing required ${key} in ${file}"
    exit 1
  fi
}

assert_env_file_permissions() {
  local file="$1"
  local mode
  local mode3
  local group
  local other
  mode="$(stat -c '%a' "$file" 2>/dev/null || true)"
  if [[ -z "$mode" ]]; then
    echo "[full] unable to determine permissions for ${file}"
    exit 1
  fi
  mode3="$(printf '%03d' "$((10#$mode % 1000))")"
  group="${mode3:1:1}"
  other="${mode3:2:1}"
  if (( other != 0 || group > 4 )); then
    echo "[full] insecure permissions on ${file} (mode ${mode3}; expected 600 or 640 style)"
    exit 1
  fi
}

echo "[full] step 1/5: website build"
npm run build >/tmp/greyhourrp-website-build.log
echo "[full] website build: PASS"

echo "[full] step 2/5: service status"
if command -v systemctl >/dev/null 2>&1; then
  if is_true "${CHECK_ADMIN_API_SERVICE}"; then
    if systemctl is-active --quiet "${ADMIN_API_SERVICE_NAME}" 2>/dev/null || sudo systemctl is-active --quiet "${ADMIN_API_SERVICE_NAME}"; then
      echo "[full] ${ADMIN_API_SERVICE_NAME}: active"
    else
      echo "[full] ${ADMIN_API_SERVICE_NAME}: NOT active"
      exit 1
    fi
  else
    echo "[full] ${ADMIN_API_SERVICE_NAME}: skipped by CHECK_ADMIN_API_SERVICE=${CHECK_ADMIN_API_SERVICE}"
  fi
  if is_true "${CHECK_DISCORD_BOT_SERVICE}"; then
    if systemctl is-active --quiet "${DISCORD_BOT_SERVICE_NAME}" 2>/dev/null || sudo systemctl is-active --quiet "${DISCORD_BOT_SERVICE_NAME}"; then
      echo "[full] ${DISCORD_BOT_SERVICE_NAME}: active"
    else
      echo "[full] ${DISCORD_BOT_SERVICE_NAME}: NOT active"
      exit 1
    fi
  else
    echo "[full] ${DISCORD_BOT_SERVICE_NAME}: skipped by CHECK_DISCORD_BOT_SERVICE=${CHECK_DISCORD_BOT_SERVICE}"
  fi
else
  echo "[full] systemctl not found, skipping service checks"
fi

echo "[full] step 3/5: secret/env sanity"
IFS=':' read -r -a bot_env_candidates <<< "$BOT_ENV_PATHS"
bot_env_file=""
for candidate in "${bot_env_candidates[@]}"; do
  if [[ -f "$candidate" ]]; then
    bot_env_file="$candidate"
    break
  fi
done
if [[ -z "$bot_env_file" ]]; then
  echo "[full] missing bot env file (checked: ${BOT_ENV_PATHS})"
  exit 1
fi
if [[ -f "$ADMIN_API_ENV_PATH" ]]; then
  assert_env_file_permissions "$ADMIN_API_ENV_PATH"
fi
assert_env_file_permissions "$bot_env_file"
assert_env_key_nonempty "$bot_env_file" "DISCORD_TOKEN"
assert_env_key_nonempty "$bot_env_file" "DISCORD_CLIENT_ID"
assert_env_key_nonempty "$bot_env_file" "DISCORD_GUILD_ID"
assert_env_key_nonempty "$bot_env_file" "ADMIN_API_BASE"
assert_env_key_nonempty "$bot_env_file" "ADMIN_BASIC_AUTH_PASS"
echo "[full] secret/env sanity: PASS"

echo "[full] step 4/5: api endpoint"
if [[ -f "$ROOT_DIR/discord-bot/.env" ]]; then
  set -a
  source "$ROOT_DIR/discord-bot/.env"
  set +a
fi

: "${ADMIN_API_BASE:?ADMIN_API_BASE is required from discord-bot/.env}"

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
if [[ "${status_code}" != "200" ]]; then
  echo "[full] api check failed: HTTP ${status_code}"
  cat /tmp/greyhourrp-api-health.json
  exit 1
fi

echo "[full] api endpoint: PASS (${API_URL})"
echo "[full] response:"
cat /tmp/greyhourrp-api-health.json

if is_true "${RUN_BOT_SMOKE_CHECK}"; then
  echo "[full] step 5/5: bot smoke check"
  cd "$ROOT_DIR/discord-bot"
  npm run smoke >/tmp/greyhourrp-bot-smoke.log
  echo "[full] bot smoke check: PASS"
else
  echo "[full] step 5/5: bot smoke check skipped by RUN_BOT_SMOKE_CHECK=${RUN_BOT_SMOKE_CHECK}"
fi

echo "[full] ALL CHECKS PASSED"
