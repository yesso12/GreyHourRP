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

classify_failure() {
  if ! scripts/smoke.sh >/tmp/greyhourrp-self-heal-smoke.log 2>&1; then
    echo "public-site-degraded"
    return
  fi
  if ! scripts/policy-gate.sh dist >/tmp/greyhourrp-self-heal-policy.log 2>&1; then
    echo "policy-violation"
    return
  fi
  echo "service-or-integrity"
}

log "running full health check"
if scripts/health-check-all.sh >/tmp/greyhourrp-self-heal-health.log 2>&1; then
  log "health check passed — no action required"
  scripts/queue-enqueue.sh rum_rollup >/dev/null 2>&1 || true
  scripts/queue-enqueue.sh build_ops_board >/dev/null 2>&1 || true
  exit 0
fi

failure_class="$(classify_failure)"
log "health check failed — classified as ${failure_class}; rebuilding and redeploying"
npm run build
scripts/provenance.sh dist dist/provenance >/dev/null 2>&1 || true
log "deploying website to ${STATIC_TARGET}"
scripts/deploy-static.sh "dist" "$STATIC_TARGET"

if is_true "${SELF_HEAL_DEPLOY_BOT}"; then
  log "deploying discord bot (${BOT_APP_DIR})"
  ( cd discord-bot && APP_DIR="${BOT_APP_DIR}" SERVICE_NAME="${BOT_SERVICE}" ./deploy.sh )
else
  log "bot deploy skipped by SELF_HEAL_DEPLOY_BOT=${SELF_HEAL_DEPLOY_BOT}"
fi

scripts/queue-enqueue.sh rum_rollup >/dev/null 2>&1 || true
scripts/queue-enqueue.sh build_ops_board >/dev/null 2>&1 || true
log "self-heal run complete"
