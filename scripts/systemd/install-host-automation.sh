#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SYSTEMD_DIR="/etc/systemd/system"
ENV_TARGET="/etc/default/greyhourrp-automation"
ENABLE_BACKUP_TIMER="${ENABLE_BACKUP_TIMER:-false}"

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

chmod +x "${REPO_ROOT}/scripts/self-heal.sh"
chmod +x "${REPO_ROOT}/scripts/health-check-all.sh"
chmod +x "${REPO_ROOT}/scripts/backup-content.sh"

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

echo "[install-host-automation] active timers:"
systemctl list-timers --all --no-pager | grep -E 'greyhourrp-(self-heal|health-check|content-backup)\.timer|NEXT|LAST|UNIT' || true

echo "[install-host-automation] done"
