#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

ADMIN_API_ENV_PATH="${ADMIN_API_ENV_PATH:-/etc/greyhourrp-admin-api.env}"
BOT_ENV_PATHS="${BOT_ENV_PATHS:-/opt/greyhourrp/discord-bot/.env:/opt/greyhourrp-discord-bot/.env}"
ADMIN_API_SERVICE_NAME="${ADMIN_API_SERVICE_NAME:-greyhourrp-admin-api}"
DISCORD_BOT_SERVICE_NAME="${DISCORD_BOT_SERVICE_NAME:-greyhourrp-discord-bot}"
SECRET_ROTATE_MIN_LENGTH="${SECRET_ROTATE_MIN_LENGTH:-40}"
SECRET_ROTATE_DRY_RUN="${SECRET_ROTATE_DRY_RUN:-false}"

is_true() {
  [[ "${1,,}" == "1" || "${1,,}" == "true" || "${1,,}" == "yes" ]]
}

log() {
  echo "[rotate-secrets] $1"
}

generate_secret() {
  local min_len="$1"
  local secret
  if command -v openssl >/dev/null 2>&1; then
    secret="$(openssl rand -base64 48 | tr -d '\n' | tr '/+' 'AZ' | cut -c1-64)"
  elif command -v node >/dev/null 2>&1; then
    secret="$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64').replace(/[\\/+]/g,'Z').slice(0,64))")"
  else
    log "ERROR: openssl or node is required to generate secrets"
    exit 1
  fi

  if [[ "${#secret}" -lt "$min_len" ]]; then
    log "ERROR: generated secret shorter than required length (${#secret} < ${min_len})"
    exit 1
  fi

  printf '%s' "$secret"
}

backup_file() {
  local file="$1"
  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"
  cp -a "$file" "${file}.bak.${timestamp}"
}

upsert_env_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(mktemp)"

  if grep -qE "^${key}=" "$file"; then
    sed "s|^${key}=.*$|${key}=${value}|" "$file" > "$tmp"
  else
    cat "$file" > "$tmp"
    printf '\n%s=%s\n' "$key" "$value" >> "$tmp"
  fi

  cat "$tmp" > "$file"
  rm -f "$tmp"
}

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    log "ERROR: missing required file: $file"
    exit 1
  fi
}

main() {
  local new_pass
  local path
  local IFS=':'

  require_file "$ADMIN_API_ENV_PATH"
  for path in $BOT_ENV_PATHS; do
    require_file "$path"
  done

  new_pass="$(generate_secret "$SECRET_ROTATE_MIN_LENGTH")"
  log "rotating ADMIN_BASIC_AUTH_PASS"

  if is_true "$SECRET_ROTATE_DRY_RUN"; then
    log "dry run enabled; no file changes will be written"
    exit 0
  fi

  backup_file "$ADMIN_API_ENV_PATH"
  upsert_env_key "$ADMIN_API_ENV_PATH" "ADMIN_BASIC_AUTH_PASS" "$new_pass"

  for path in $BOT_ENV_PATHS; do
    backup_file "$path"
    upsert_env_key "$path" "ADMIN_BASIC_AUTH_PASS" "$new_pass"
  done

  chmod 0600 "$ADMIN_API_ENV_PATH" || true
  for path in $BOT_ENV_PATHS; do
    chmod 0600 "$path" || true
  done

  if command -v systemctl >/dev/null 2>&1; then
    systemctl restart "$ADMIN_API_SERVICE_NAME"
    systemctl restart "$DISCORD_BOT_SERVICE_NAME"
    systemctl is-active --quiet "$ADMIN_API_SERVICE_NAME"
    systemctl is-active --quiet "$DISCORD_BOT_SERVICE_NAME"
  fi

  log "rotation complete"
}

main "$@"
