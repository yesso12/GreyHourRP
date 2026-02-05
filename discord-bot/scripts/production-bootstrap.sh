#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE_NAME="${SERVICE_NAME:-greyhourrp-discord-bot}"
RESTART_TIMEOUT_SECONDS="${RESTART_TIMEOUT_SECONDS:-30}"

log() {
  local level="$1"
  shift
  printf '[bootstrap][%s] %s\n' "$level" "$*"
}

pass() {
  log "PASS" "$*"
}

fail() {
  log "FAIL" "$*"
  exit 1
}

run_systemctl() {
  if command -v sudo >/dev/null 2>&1; then
    sudo systemctl "$@"
  else
    systemctl "$@"
  fi
}

wait_for_service_active() {
  local service_name="$1"
  local timeout_seconds="$2"
  local start_ts
  start_ts="$(date +%s)"

  while true; do
    if run_systemctl is-active "$service_name" >/dev/null 2>&1; then
      return 0
    fi

    local now_ts
    now_ts="$(date +%s)"
    if (( now_ts - start_ts >= timeout_seconds )); then
      return 1
    fi
    sleep 1
  done
}

log "INFO" "starting production bootstrap in ${ROOT_DIR}"

command -v npm >/dev/null 2>&1 || fail "npm not found; install Node.js/npm first."
command -v systemctl >/dev/null 2>&1 || fail "systemctl not found; this script is for systemd hosts."
[[ -f ".env" ]] || fail "missing ${ROOT_DIR}/.env (copy from .env.example and fill it first)."

if ! systemctl list-unit-files --type=service --no-legend | awk '{print $1}' | grep -Fxq "${SERVICE_NAME}.service"; then
  fail "systemd unit ${SERVICE_NAME}.service is not registered. Run deploy first."
fi

log "INFO" "step 1/5: register discord slash commands"
npm run register
pass "slash commands registered"

log "INFO" "step 2/5: canary pre-smoke (must pass before restart)"
bash scripts/smoke-check.sh
pass "pre-smoke check passed"

log "INFO" "step 3/5: ensure service is enabled (idempotent)"
if run_systemctl is-enabled "${SERVICE_NAME}" >/dev/null 2>&1; then
  pass "service already enabled"
else
  run_systemctl enable "${SERVICE_NAME}"
  pass "service enabled"
fi

log "INFO" "step 4/5: restart service"
run_systemctl restart "${SERVICE_NAME}"
if ! wait_for_service_active "${SERVICE_NAME}" "${RESTART_TIMEOUT_SECONDS}"; then
  run_systemctl --no-pager --full status "${SERVICE_NAME}" || true
  fail "service did not become active within ${RESTART_TIMEOUT_SECONDS}s"
fi
pass "service restarted and active"

log "INFO" "step 5/5: canary post-smoke"
bash scripts/smoke-check.sh
pass "smoke-check succeeded"

pass "production bootstrap complete"
