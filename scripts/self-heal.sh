#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STATIC_TARGET="${1:-/var/www/greyhourrp}"
BOT_APP_DIR="${BOT_APP_DIR:-/opt/greyhourrp-discord-bot}"
BOT_SERVICE="${BOT_SERVICE:-greyhourrp-discord-bot}"
SELF_HEAL_DEPLOY_BOT="${SELF_HEAL_DEPLOY_BOT:-true}"

is_true() {
  [[ "${1,,}" == "1" || "${1,,}" == "true" || "${1,,}" == "yes" ]]
}

log() {
  echo "[self-heal] $1"
}

log "running full health check"
if scripts/health-check-all.sh; then
  log "health check passed — no action required"
  exit 0
fi

log "health check failed — rebuilding and redeploying"
npm run build
log "deploying website to ${STATIC_TARGET}"
scripts/deploy-static.sh "dist" "$STATIC_TARGET"

if is_true "${SELF_HEAL_DEPLOY_BOT}"; then
  log "deploying discord bot (${BOT_APP_DIR})"
  ( cd discord-bot && APP_DIR="${BOT_APP_DIR}" SERVICE_NAME="${BOT_SERVICE}" ./deploy.sh )
else
  log "bot deploy skipped by SELF_HEAL_DEPLOY_BOT=${SELF_HEAL_DEPLOY_BOT}"
fi

log "self-heal run complete"
