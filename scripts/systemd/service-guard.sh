#!/usr/bin/env bash
set -euo pipefail

WATCH_SERVICES="${WATCH_SERVICES:-greyhourrp-admin-api greyhourrp-discord-bot}"
RESTART_COOLDOWN_SECONDS="${RESTART_COOLDOWN_SECONDS:-300}"
STATE_DIR="${SERVICE_GUARD_STATE_DIR:-/var/lib/greyhourrp-service-guard}"

mkdir -p "$STATE_DIR"

is_active() {
  local svc="$1"
  if systemctl is-active --quiet "$svc"; then
    return 0
  fi
  return 1
}

last_restart_epoch() {
  local svc="$1"
  local file="$STATE_DIR/${svc}.last_restart"
  if [[ -f "$file" ]]; then
    cat "$file"
  else
    echo 0
  fi
}

record_restart_epoch() {
  local svc="$1"
  local now="$2"
  printf '%s\n' "$now" > "$STATE_DIR/${svc}.last_restart"
}

now_epoch="$(date +%s)"

for svc in $WATCH_SERVICES; do
  if is_active "$svc"; then
    echo "[service-guard] $svc active"
    continue
  fi

  last="$(last_restart_epoch "$svc")"
  since=$((now_epoch - last))

  if (( since < RESTART_COOLDOWN_SECONDS )); then
    echo "[service-guard] $svc down, cooldown active (${since}s < ${RESTART_COOLDOWN_SECONDS}s); skip restart"
    continue
  fi

  echo "[service-guard] $svc down, attempting restart"
  systemctl restart "$svc"

  if is_active "$svc"; then
    record_restart_epoch "$svc" "$now_epoch"
    echo "[service-guard] $svc restart: PASS"
  else
    echo "[service-guard] $svc restart: FAIL"
    exit 1
  fi
done

echo "[service-guard] complete"
