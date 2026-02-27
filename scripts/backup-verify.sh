#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/greyhourrp}"
LATEST_ARCHIVE="$(find "$BACKUP_ROOT" -maxdepth 1 -type f -name 'greyhourrp-backup-*.tar.gz' | sort | tail -n 1)"

if [[ -z "$LATEST_ARCHIVE" ]]; then
  echo "[backup-verify] no backup archive found" >&2
  exit 1
fi

if ! tar -tzf "$LATEST_ARCHIVE" >/dev/null; then
  echo "[backup-verify] archive unreadable: $LATEST_ARCHIVE" >&2
  exit 1
fi

if [[ -f "$LATEST_ARCHIVE.sha256" ]]; then
  sha256sum -c "$LATEST_ARCHIVE.sha256"
fi

BACKUP_ROOT="$BACKUP_ROOT" "$ROOT_DIR/scripts/restore-drill.sh"

echo "[backup-verify] PASS"
