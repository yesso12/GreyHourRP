#!/usr/bin/env bash
set -euo pipefail

CONTENT_ROOT="${CONTENT_ROOT:-/var/www/greyhourrp/content}"
BOT_DATA_ROOT="${BOT_DATA_ROOT:-/opt/greyhourrp-discord-bot/data}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/greyhourrp}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
DEST_DIR="${BACKUP_ROOT}/${STAMP}"
ARCHIVE_PATH="${BACKUP_ROOT}/greyhourrp-backup-${STAMP}.tar.gz"

log() {
  echo "[backup-content] $1"
}

mkdir -p "${BACKUP_ROOT}"
mkdir -p "${DEST_DIR}"

if [[ -d "${CONTENT_ROOT}" ]]; then
  mkdir -p "${DEST_DIR}/content"
  cp -a "${CONTENT_ROOT}/." "${DEST_DIR}/content/"
  log "copied content root: ${CONTENT_ROOT}"
else
  log "content root missing, skipping: ${CONTENT_ROOT}"
fi

if [[ -d "${BOT_DATA_ROOT}" ]]; then
  mkdir -p "${DEST_DIR}/bot-data"
  cp -a "${BOT_DATA_ROOT}/." "${DEST_DIR}/bot-data/"
  log "copied bot data root: ${BOT_DATA_ROOT}"
else
  log "bot data root missing, skipping: ${BOT_DATA_ROOT}"
fi

tar -C "${BACKUP_ROOT}" -czf "${ARCHIVE_PATH}" "${STAMP}"
rm -rf "${DEST_DIR}"
log "backup archive created: ${ARCHIVE_PATH}"

if tar -tzf "${ARCHIVE_PATH}" >/dev/null 2>&1; then
  log "backup archive integrity: PASS"
else
  log "backup archive integrity: FAIL"
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${ARCHIVE_PATH}" > "${ARCHIVE_PATH}.sha256"
  log "checksum written: ${ARCHIVE_PATH}.sha256"
fi

if [[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]] && [[ "${RETENTION_DAYS}" -ge 1 ]]; then
  find "${BACKUP_ROOT}" -maxdepth 1 -type f -name 'greyhourrp-backup-*.tar.gz' -mtime +"${RETENTION_DAYS}" -print -delete | sed 's/^/[backup-content] pruned: /' || true
  find "${BACKUP_ROOT}" -maxdepth 1 -type f -name 'greyhourrp-backup-*.tar.gz.sha256' -mtime +"${RETENTION_DAYS}" -print -delete | sed 's/^/[backup-content] pruned checksum: /' || true
fi

log "backup complete"
