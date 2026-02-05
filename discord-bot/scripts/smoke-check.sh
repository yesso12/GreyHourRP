#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env" ]]; then
  set -a
  source ".env"
  set +a
fi

: "${ADMIN_API_BASE:?ADMIN_API_BASE is required in .env}"
: "${ADMIN_API_KEY:?ADMIN_API_KEY is required in .env}"

API_URL="${ADMIN_API_BASE%/}/api/admin/content/server-status"

CURL_ARGS=(
  --silent
  --show-error
  --location
  --output /tmp/greyhourrp-smoke-body.json
  --write-out "%{http_code}"
  --header "X-Admin-Key: ${ADMIN_API_KEY}"
)

if [[ -n "${ADMIN_BASIC_AUTH_HEADER:-}" ]]; then
  CURL_ARGS+=(--header "Authorization: ${ADMIN_BASIC_AUTH_HEADER}")
elif [[ -n "${ADMIN_BASIC_AUTH_USER:-}" && -n "${ADMIN_BASIC_AUTH_PASS:-}" ]]; then
  CURL_ARGS+=(--user "${ADMIN_BASIC_AUTH_USER}:${ADMIN_BASIC_AUTH_PASS}")
fi

echo "[smoke] checking ${API_URL}"
status_code="$(curl "${CURL_ARGS[@]}" "${API_URL}")"
body="$(cat /tmp/greyhourrp-smoke-body.json)"

if [[ "${status_code}" != "200" ]]; then
  echo "[smoke] FAIL: expected HTTP 200, got ${status_code}"
  echo "[smoke] body: ${body}"
  exit 1
fi

echo "[smoke] PASS: admin API returned 200"
echo "[smoke] body: ${body}"

if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files | grep -q '^greyhourrp-admin-api\.service'; then
    echo "[smoke] service: greyhourrp-admin-api"
    systemctl is-active greyhourrp-admin-api
  fi
  if systemctl list-unit-files | grep -q '^greyhourrp-discord-bot\.service'; then
    echo "[smoke] service: greyhourrp-discord-bot"
    systemctl is-active greyhourrp-discord-bot
  fi
fi

echo "[smoke] complete"
