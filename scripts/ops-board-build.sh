#!/usr/bin/env bash
set -euo pipefail

OUT_JSON="${OPS_BOARD_JSON:-/var/www/greyhourrp/content/ops-board.json}"
RUM_JSON="${RUM_OUTPUT_JSON:-/var/www/greyhourrp/content/rum-dashboard.json}"
STATUS_JSON="${STATUS_JSON:-/var/www/greyhourrp/content/server-status.json}"
SITE_FLAGS_JSON="${SITE_FLAGS_JSON:-/var/www/greyhourrp/content/site-flags.json}"

mkdir -p "$(dirname "$OUT_JSON")"

node - "$OUT_JSON" "$RUM_JSON" "$STATUS_JSON" "$SITE_FLAGS_JSON" <<'NODE'
const fs = require('fs')

const out = process.argv[2]
const rumPath = process.argv[3]
const statusPath = process.argv[4]
const flagsPath = process.argv[5]

const readJson = (p, fallback) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fallback }
}

const payload = {
  generatedUtc: new Date().toISOString(),
  status: readJson(statusPath, {}),
  siteFlags: readJson(flagsPath, {}),
  rum: readJson(rumPath, { totals: { all: 0, warn: 0, error: 0 } }),
  automation: {
    selfHeal: true,
    serviceGuard: true,
    integrityCheck: true,
    backupDrill: true,
    sloRollback: true,
    policyGate: true,
    canary: true,
    driftDetection: true,
    provenance: true,
    queueWorker: true,
    blueGreenApi: true,
    autoscalePolicy: true
  }
}

fs.writeFileSync(out, JSON.stringify(payload, null, 2))
NODE

echo "[ops-board] wrote $OUT_JSON"
