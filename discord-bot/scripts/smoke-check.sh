#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
SMOKE_STATUS_FILE="${ROOT_DIR}/data/smoke-status.json"

if [[ -f ".env" ]]; then
  set -a
  source ".env"
  set +a
fi

: "${ADMIN_API_BASE:?ADMIN_API_BASE is required in .env}"

API_URL="${ADMIN_API_BASE%/}/api/admin/content/server-status"

CURL_ARGS=(
  --silent
  --show-error
  --location
  --output /tmp/greyhourrp-smoke-body.json
  --write-out "%{http_code}"
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
  mkdir -p "$(dirname "${SMOKE_STATUS_FILE}")"
  printf '{"ok":false,"checkedAt":"%s","statusCode":"%s","apiUrl":"%s"}\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "${status_code}" "${API_URL}" > "${SMOKE_STATUS_FILE}"
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

mkdir -p "$(dirname "${SMOKE_STATUS_FILE}")"
printf '{"ok":true,"checkedAt":"%s","statusCode":"%s","apiUrl":"%s"}\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "${status_code}" "${API_URL}" > "${SMOKE_STATUS_FILE}"

echo "[smoke] complete"
