#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 2 ]]; then
  echo "Usage: run-with-alert.sh <job-name> <command> [args...]"
  exit 2
fi

JOB_NAME="$1"
shift

LOG_FILE="$(mktemp "/tmp/greyhourrp-${JOB_NAME//[^a-zA-Z0-9_-]/_}.XXXX.log")"

set +e
"$@" >"${LOG_FILE}" 2>&1
EXIT_CODE=$?
set -e

if [[ -x /opt/greyhourrp/scripts/systemd/notify-automation.sh ]]; then
  /opt/greyhourrp/scripts/systemd/notify-automation.sh "${JOB_NAME}" "${EXIT_CODE}" "${LOG_FILE}" || true
fi

cat "${LOG_FILE}"
rm -f "${LOG_FILE}"

exit "${EXIT_CODE}"
