#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[full] step 1/4: website build"
npm run build >/tmp/greyhourrp-website-build.log
echo "[full] website build: PASS"

echo "[full] step 2/4: service status"
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet greyhourrp-admin-api 2>/dev/null || sudo systemctl is-active --quiet greyhourrp-admin-api; then
    echo "[full] greyhourrp-admin-api: active"
  else
    echo "[full] greyhourrp-admin-api: NOT active"
    exit 1
  fi
  if systemctl is-active --quiet greyhourrp-discord-bot 2>/dev/null || sudo systemctl is-active --quiet greyhourrp-discord-bot; then
    echo "[full] greyhourrp-discord-bot: active"
  else
    echo "[full] greyhourrp-discord-bot: NOT active"
    exit 1
  fi
else
  echo "[full] systemctl not found, skipping service checks"
fi

echo "[full] step 3/4: api endpoint"
if [[ -f "$ROOT_DIR/discord-bot/.env" ]]; then
  set -a
  source "$ROOT_DIR/discord-bot/.env"
  set +a
fi

: "${ADMIN_API_BASE:?ADMIN_API_BASE is required from discord-bot/.env}"
: "${ADMIN_API_KEY:?ADMIN_API_KEY is required from discord-bot/.env}"

API_URL="${ADMIN_API_BASE%/}/api/admin/content/server-status"
CURL_ARGS=(
  --silent
  --show-error
  --location
  --output /tmp/greyhourrp-api-health.json
  --write-out "%{http_code}"
  --header "X-Admin-Key: ${ADMIN_API_KEY}"
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

echo "[full] step 4/4: bot smoke check"
cd "$ROOT_DIR/discord-bot"
npm run smoke >/tmp/greyhourrp-bot-smoke.log
echo "[full] bot smoke check: PASS"

echo "[full] ALL CHECKS PASSED"
