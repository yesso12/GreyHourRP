#!/usr/bin/env bash
set -euo pipefail

METRICS_JSON="${AUTOSCALE_METRICS_JSON:-/var/www/greyhourrp/content/rum-dashboard.json}"
DECISION_OUT="${AUTOSCALE_DECISION_OUT:-/var/lib/greyhourrp-autoscale/decision.json}"
WARN_ERROR_SCALE_UP_THRESHOLD="${WARN_ERROR_SCALE_UP_THRESHOLD:-25}"
LOW_TRAFFIC_SCALE_DOWN_THRESHOLD="${LOW_TRAFFIC_SCALE_DOWN_THRESHOLD:-5}"

mkdir -p "$(dirname "$DECISION_OUT")"

node - "$METRICS_JSON" "$DECISION_OUT" "$WARN_ERROR_SCALE_UP_THRESHOLD" "$LOW_TRAFFIC_SCALE_DOWN_THRESHOLD" <<'NODE'
const fs = require('fs')

const metricsPath = process.argv[2]
const outPath = process.argv[3]
const up = Number(process.argv[4] || '25')
const down = Number(process.argv[5] || '5')

let metrics = { totals: { all: 0, warn: 0, error: 0 } }
try { metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8')) } catch {}

const total = Number(metrics?.totals?.all || 0)
const errors = Number(metrics?.totals?.error || 0)
const warns = Number(metrics?.totals?.warn || 0)
const bad = errors + warns

let decision = 'hold'
let reason = 'traffic and error budget within thresholds'

if (bad >= up) {
  decision = 'scale_up'
  reason = `warn+error ${bad} >= ${up}`
} else if (total <= down && bad === 0) {
  decision = 'scale_down'
  reason = `low traffic ${total} and no warn/error`
}

const payload = {
  generatedUtc: new Date().toISOString(),
  decision,
  reason,
  totals: { all: total, warn: warns, error: errors }
}

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2))
NODE

echo "[autoscale-policy] wrote $DECISION_OUT"
