#!/usr/bin/env bash
set -euo pipefail

BASELINE_FILE="${DRIFT_BASELINE_FILE:-/var/lib/greyhourrp-drift/baseline.sha256}"
STATE_DIR="$(dirname "$BASELINE_FILE")"
MODE="${1:-check}"

WATCH_ITEMS=(
  "/etc/systemd/system/greyhourrp-admin-api.service"
  "/etc/systemd/system/greyhourrp-discord-bot.service"
  "/etc/nginx/sites-enabled/greyhourrp"
  "/etc/greyhourrp-admin-api.env"
  "/etc/default/greyhourrp-automation"
)

log() {
  echo "[drift-detect] $1"
}

mkdir -p "$STATE_DIR"

current_file="$(mktemp)"
for item in "${WATCH_ITEMS[@]}"; do
  if [[ -f "$item" ]]; then
    sha256sum "$item" >> "$current_file"
  else
    echo "MISSING  $item" >> "$current_file"
  fi
done

if [[ "$MODE" == "baseline" ]]; then
  cp -f "$current_file" "$BASELINE_FILE"
  rm -f "$current_file"
  log "baseline updated: $BASELINE_FILE"
  exit 0
fi

if [[ ! -f "$BASELINE_FILE" ]]; then
  cp -f "$current_file" "$BASELINE_FILE"
  rm -f "$current_file"
  log "baseline missing; initialized at $BASELINE_FILE"
  exit 0
fi

if diff -u "$BASELINE_FILE" "$current_file" >/tmp/greyhourrp-drift.diff; then
  rm -f "$current_file" /tmp/greyhourrp-drift.diff
  log "no drift"
  exit 0
fi

cat /tmp/greyhourrp-drift.diff
rm -f "$current_file"
log "drift detected"
exit 1
