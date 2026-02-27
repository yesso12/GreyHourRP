#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${1:-$ROOT_DIR/dist}"
TARGET_DIR="${2:-/var/www/greyhourrp}"
CANARY_DIR="${CANARY_DIR:-/var/www/greyhourrp-canary}"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-https://greyhourrp.xyz}"
CANARY_SMOKE_BASE_URL="${CANARY_SMOKE_BASE_URL:-$SMOKE_BASE_URL}"

log() {
  echo "[canary-promote] $1"
}

if [[ ! -d "$DIST_DIR" ]]; then
  echo "[canary-promote] dist not found: $DIST_DIR" >&2
  exit 1
fi

log "deploying candidate to canary dir: $CANARY_DIR"
"$ROOT_DIR/scripts/deploy-static.sh" "$DIST_DIR" "$CANARY_DIR"

log "running canary smoke"
SMOKE_BASE_URL="$CANARY_SMOKE_BASE_URL" "$ROOT_DIR/scripts/smoke.sh"

log "canary passed; promoting to production dir: $TARGET_DIR"
"$ROOT_DIR/scripts/deploy-static.sh" "$DIST_DIR" "$TARGET_DIR"

log "running production smoke"
SMOKE_BASE_URL="$SMOKE_BASE_URL" "$ROOT_DIR/scripts/smoke.sh"

log "promotion complete"
