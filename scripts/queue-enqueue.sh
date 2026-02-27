#!/usr/bin/env bash
set -euo pipefail

QUEUE_DIR="${AUTOMATION_QUEUE_DIR:-/var/lib/greyhourrp-automation-queue}"
mkdir -p "$QUEUE_DIR"

TYPE="${1:-}"
if [[ -z "$TYPE" ]]; then
  echo "usage: $0 <job-type>" >&2
  exit 2
fi

STAMP="$(date -u +%Y%m%d-%H%M%S)-$RANDOM"
FILE="$QUEUE_DIR/${STAMP}.json"
cat > "$FILE" <<JSON
{
  "type": "$TYPE",
  "createdUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo "[queue-enqueue] queued $TYPE -> $FILE"
