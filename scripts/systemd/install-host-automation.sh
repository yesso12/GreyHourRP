#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SYSTEMD_DIR="/etc/systemd/system"
ENV_TARGET="/etc/default/greyhourrp-automation"
ENABLE_BACKUP_TIMER="${ENABLE_BACKUP_TIMER:-false}"
ENABLE_RESTORE_DRILL_TIMER="${ENABLE_RESTORE_DRILL_TIMER:-false}"
ENABLE_SECRET_ROTATION_TIMER="${ENABLE_SECRET_ROTATION_TIMER:-false}"
ENABLE_SERVICE_GUARD_TIMER="${ENABLE_SERVICE_GUARD_TIMER:-true}"
ENABLE_INTEGRITY_TIMER="${ENABLE_INTEGRITY_TIMER:-true}"
ENABLE_SLO_GUARD_TIMER="${ENABLE_SLO_GUARD_TIMER:-true}"
ENABLE_DRIFT_TIMER="${ENABLE_DRIFT_TIMER:-true}"
ENABLE_RUM_TIMER="${ENABLE_RUM_TIMER:-true}"
ENABLE_OPS_BOARD_TIMER="${ENABLE_OPS_BOARD_TIMER:-true}"
ENABLE_BACKUP_VERIFY_TIMER="${ENABLE_BACKUP_VERIFY_TIMER:-false}"
ENABLE_AUTOSCALE_TIMER="${ENABLE_AUTOSCALE_TIMER:-true}"
ENABLE_QUEUE_WORKER_SERVICE="${ENABLE_QUEUE_WORKER_SERVICE:-true}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "[install-host-automation] run as root (sudo)."
  exit 1
fi

copy_unit() {
  local name="$1"
  cp -f "${SCRIPT_DIR}/${name}" "${SYSTEMD_DIR}/${name}"
  chmod 0644 "${SYSTEMD_DIR}/${name}"
  echo "[install-host-automation] installed ${SYSTEMD_DIR}/${name}"
}

copy_unit "greyhourrp-self-heal.service"
copy_unit "greyhourrp-self-heal.timer"
copy_unit "greyhourrp-health-check.service"
copy_unit "greyhourrp-health-check.timer"
copy_unit "greyhourrp-content-backup.service"
copy_unit "greyhourrp-content-backup.timer"
copy_unit "greyhourrp-restore-drill.service"
copy_unit "greyhourrp-restore-drill.timer"
copy_unit "greyhourrp-rotate-secrets.service"
copy_unit "greyhourrp-rotate-secrets.timer"
copy_unit "greyhourrp-service-guard.service"
copy_unit "greyhourrp-service-guard.timer"
copy_unit "greyhourrp-integrity-check.service"
copy_unit "greyhourrp-integrity-check.timer"
copy_unit "greyhourrp-slo-guard.service"
copy_unit "greyhourrp-slo-guard.timer"
copy_unit "greyhourrp-drift-detect.service"
copy_unit "greyhourrp-drift-detect.timer"
copy_unit "greyhourrp-rum-rollup.service"
copy_unit "greyhourrp-rum-rollup.timer"
copy_unit "greyhourrp-ops-board.service"
copy_unit "greyhourrp-ops-board.timer"
copy_unit "greyhourrp-backup-verify.service"
copy_unit "greyhourrp-backup-verify.timer"
copy_unit "greyhourrp-autoscale-policy.service"
copy_unit "greyhourrp-autoscale-policy.timer"
copy_unit "greyhourrp-queue-worker.service"

chmod +x "${REPO_ROOT}/scripts/self-heal.sh"
chmod +x "${REPO_ROOT}/scripts/health-check-all.sh"
chmod +x "${REPO_ROOT}/scripts/backup-content.sh"
chmod +x "${REPO_ROOT}/scripts/restore-drill.sh"
chmod +x "${REPO_ROOT}/scripts/systemd/run-with-alert.sh"
chmod +x "${REPO_ROOT}/scripts/systemd/notify-automation.sh"
chmod +x "${REPO_ROOT}/scripts/systemd/rotate-secrets.sh"
chmod +x "${REPO_ROOT}/scripts/systemd/service-guard.sh"
chmod +x "${REPO_ROOT}/scripts/integrity-check.sh"
chmod +x "${REPO_ROOT}/scripts/policy-gate.sh"
chmod +x "${REPO_ROOT}/scripts/slo-rollback.sh"
chmod +x "${REPO_ROOT}/scripts/canary-promote.sh"
chmod +x "${REPO_ROOT}/scripts/drift-detect.sh"
chmod +x "${REPO_ROOT}/scripts/provenance.sh"
chmod +x "${REPO_ROOT}/scripts/rum-rollup.sh"
chmod +x "${REPO_ROOT}/scripts/ops-board-build.sh"
chmod +x "${REPO_ROOT}/scripts/backup-verify.sh"
chmod +x "${REPO_ROOT}/scripts/autoscale-policy.sh"
chmod +x "${REPO_ROOT}/scripts/admin-api-bluegreen.sh"
chmod +x "${REPO_ROOT}/scripts/queue-enqueue.sh"
chmod +x "${REPO_ROOT}/scripts/security-hardening-check.sh"

if [[ ! -f "${ENV_TARGET}" ]]; then
  install -m 0644 "${SCRIPT_DIR}/greyhourrp-automation.env.example" "${ENV_TARGET}"
  echo "[install-host-automation] wrote ${ENV_TARGET} from example"
else
  echo "[install-host-automation] keeping existing ${ENV_TARGET}"
fi

systemctl daemon-reload

systemctl enable --now greyhourrp-self-heal.timer
systemctl enable --now greyhourrp-health-check.timer

if [[ "${ENABLE_BACKUP_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-content-backup.timer
  echo "[install-host-automation] backup timer enabled"
else
  systemctl disable --now greyhourrp-content-backup.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] backup timer installed but disabled (set ENABLE_BACKUP_TIMER=true to enable)"
fi

if [[ "${ENABLE_RESTORE_DRILL_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-restore-drill.timer
  echo "[install-host-automation] restore drill timer enabled"
else
  systemctl disable --now greyhourrp-restore-drill.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] restore drill timer installed but disabled (set ENABLE_RESTORE_DRILL_TIMER=true to enable)"
fi

if [[ "${ENABLE_SECRET_ROTATION_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-rotate-secrets.timer
  echo "[install-host-automation] secrets rotation timer enabled"
else
  systemctl disable --now greyhourrp-rotate-secrets.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] secrets rotation timer installed but disabled (set ENABLE_SECRET_ROTATION_TIMER=true to enable)"
fi

if [[ "${ENABLE_SERVICE_GUARD_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-service-guard.timer
  echo "[install-host-automation] service guard timer enabled"
else
  systemctl disable --now greyhourrp-service-guard.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] service guard timer installed but disabled (set ENABLE_SERVICE_GUARD_TIMER=true to enable)"
fi

if [[ "${ENABLE_INTEGRITY_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-integrity-check.timer
  echo "[install-host-automation] integrity timer enabled"
else
  systemctl disable --now greyhourrp-integrity-check.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] integrity timer installed but disabled (set ENABLE_INTEGRITY_TIMER=true to enable)"
fi

if [[ "${ENABLE_SLO_GUARD_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-slo-guard.timer
  echo "[install-host-automation] slo guard timer enabled"
else
  systemctl disable --now greyhourrp-slo-guard.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] slo guard timer installed but disabled (set ENABLE_SLO_GUARD_TIMER=true to enable)"
fi

if [[ "${ENABLE_DRIFT_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-drift-detect.timer
  echo "[install-host-automation] drift detection timer enabled"
else
  systemctl disable --now greyhourrp-drift-detect.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] drift timer installed but disabled (set ENABLE_DRIFT_TIMER=true to enable)"
fi

if [[ "${ENABLE_RUM_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-rum-rollup.timer
  echo "[install-host-automation] rum rollup timer enabled"
else
  systemctl disable --now greyhourrp-rum-rollup.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] rum timer installed but disabled (set ENABLE_RUM_TIMER=true to enable)"
fi

if [[ "${ENABLE_OPS_BOARD_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-ops-board.timer
  echo "[install-host-automation] ops board timer enabled"
else
  systemctl disable --now greyhourrp-ops-board.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] ops board timer installed but disabled (set ENABLE_OPS_BOARD_TIMER=true to enable)"
fi

if [[ "${ENABLE_BACKUP_VERIFY_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-backup-verify.timer
  echo "[install-host-automation] backup verify timer enabled"
else
  systemctl disable --now greyhourrp-backup-verify.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] backup verify timer installed but disabled (set ENABLE_BACKUP_VERIFY_TIMER=true to enable)"
fi

if [[ "${ENABLE_AUTOSCALE_TIMER}" == "true" ]]; then
  systemctl enable --now greyhourrp-autoscale-policy.timer
  echo "[install-host-automation] autoscale policy timer enabled"
else
  systemctl disable --now greyhourrp-autoscale-policy.timer >/dev/null 2>&1 || true
  echo "[install-host-automation] autoscale timer installed but disabled (set ENABLE_AUTOSCALE_TIMER=true to enable)"
fi

if [[ "${ENABLE_QUEUE_WORKER_SERVICE}" == "true" ]]; then
  systemctl enable --now greyhourrp-queue-worker.service
  echo "[install-host-automation] queue worker service enabled"
else
  systemctl disable --now greyhourrp-queue-worker.service >/dev/null 2>&1 || true
  echo "[install-host-automation] queue worker service installed but disabled (set ENABLE_QUEUE_WORKER_SERVICE=true to enable)"
fi

echo "[install-host-automation] active timers:"
systemctl list-timers --all --no-pager | grep -E 'greyhourrp-(self-heal|health-check|content-backup|restore-drill|rotate-secrets|service-guard|integrity-check|slo-guard|drift-detect|rum-rollup|ops-board|backup-verify|autoscale-policy)\.timer|NEXT|LAST|UNIT' || true

echo "[install-host-automation] done"
