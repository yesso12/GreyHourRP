#!/usr/bin/env bash
set -euo pipefail

SRC_LOG="${RUM_TELEMETRY_LOG:-/var/log/greyhourrp-web-telemetry.jsonl}"
OUT_JSON="${RUM_OUTPUT_JSON:-/var/www/greyhourrp/content/rum-dashboard.json}"
WINDOW_MINUTES="${RUM_WINDOW_MINUTES:-60}"

mkdir -p "$(dirname "$OUT_JSON")"

node - "$SRC_LOG" "$OUT_JSON" "$WINDOW_MINUTES" <<'NODE'
const fs = require('fs')

const src = process.argv[2]
const out = process.argv[3]
const windowMinutes = Number(process.argv[4] || '60')
const since = Date.now() - windowMinutes * 60 * 1000

const data = {
  windowMinutes,
  generatedUtc: new Date().toISOString(),
  totals: { all: 0, info: 0, warn: 0, error: 0 },
  events: {},
  topPaths: {}
}

if (fs.existsSync(src)) {
  const lines = fs.readFileSync(src, 'utf8').split(/\n/).filter(Boolean).slice(-5000)
  for (const line of lines) {
    let row
    try { row = JSON.parse(line) } catch { continue }
    const ts = row.ts ? Date.parse(row.ts) : Date.now()
    if (!Number.isFinite(ts) || ts < since) continue

    const level = String(row.level || 'info').toLowerCase()
    const event = String(row.event || 'unknown')
    const path = String(row.path || '/')

    data.totals.all += 1
    if (level === 'warn') data.totals.warn += 1
    else if (level === 'error') data.totals.error += 1
    else data.totals.info += 1

    data.events[event] = (data.events[event] || 0) + 1
    data.topPaths[path] = (data.topPaths[path] || 0) + 1
  }
}

fs.writeFileSync(out, JSON.stringify(data, null, 2))
NODE

echo "[rum-rollup] wrote $OUT_JSON"
