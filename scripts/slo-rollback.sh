#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${1:-/var/www/greyhourrp}"
CHECK_COUNT="${SLO_CHECK_COUNT:-3}"
FAIL_THRESHOLD="${SLO_FAIL_THRESHOLD:-2}"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-https://greyhourrp.xyz}"

log() {
  echo "[slo-rollback] $1"
}

is_true() {
  [[ "${1,,}" == "1" || "${1,,}" == "true" || "${1,,}" == "yes" ]]
}

if [[ ! "$CHECK_COUNT" =~ ^[0-9]+$ ]] || (( CHECK_COUNT < 1 )); then
  echo "[slo-rollback] invalid SLO_CHECK_COUNT=${CHECK_COUNT}" >&2
  exit 2
fi
if [[ ! "$FAIL_THRESHOLD" =~ ^[0-9]+$ ]] || (( FAIL_THRESHOLD < 1 )); then
  echo "[slo-rollback] invalid SLO_FAIL_THRESHOLD=${FAIL_THRESHOLD}" >&2
  exit 2
fi

failures=0
for i in $(seq 1 "$CHECK_COUNT"); do
  if SMOKE_BASE_URL="$SMOKE_BASE_URL" "$ROOT_DIR/scripts/smoke.sh" >/tmp/greyhourrp-slo-smoke-${i}.log 2>&1; then
    log "probe ${i}/${CHECK_COUNT}: pass"
  else
    failures=$((failures + 1))
    log "probe ${i}/${CHECK_COUNT}: fail"
  fi
done

if (( failures >= FAIL_THRESHOLD )); then
  log "SLO breach detected (${failures}/${CHECK_COUNT} failed). Rolling back static site."
  "$ROOT_DIR/scripts/rollback-static.sh" "$TARGET_DIR" latest
  if SMOKE_BASE_URL="$SMOKE_BASE_URL" "$ROOT_DIR/scripts/smoke.sh" >/tmp/greyhourrp-slo-post-rollback.log 2>&1; then
    log "rollback verification: pass"
    exit 0
  fi
  log "rollback verification: fail"
  exit 1
fi

log "SLO healthy (${failures}/${CHECK_COUNT} failed); no rollback"
