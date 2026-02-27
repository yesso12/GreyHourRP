#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const queueDir = process.env.AUTOMATION_QUEUE_DIR || '/var/lib/greyhourrp-automation-queue'
const doneDir = path.join(queueDir, 'done')
const deadDir = path.join(queueDir, 'dead')
const pollMs = Number(process.env.AUTOMATION_QUEUE_POLL_MS || 3000)

const ensureDir = (p) => fs.mkdirSync(p, { recursive: true })
ensureDir(queueDir)
ensureDir(doneDir)
ensureDir(deadDir)

function runJob(job) {
  if (!job?.type) throw new Error('missing job.type')
  if (job.type === 'build_ops_board') {
    const res = spawnSync('/opt/greyhourrp/scripts/ops-board-build.sh', [], { stdio: 'inherit' })
    if (res.status !== 0) throw new Error(`build_ops_board failed with ${res.status}`)
    return
  }
  if (job.type === 'rum_rollup') {
    const res = spawnSync('/opt/greyhourrp/scripts/rum-rollup.sh', [], { stdio: 'inherit' })
    if (res.status !== 0) throw new Error(`rum_rollup failed with ${res.status}`)
    return
  }
  throw new Error(`unsupported job type: ${job.type}`)
}

function processOne() {
  const files = fs.readdirSync(queueDir).filter((f) => f.endsWith('.json')).sort()
  if (files.length === 0) return

  const file = files[0]
  const full = path.join(queueDir, file)
  try {
    const payload = JSON.parse(fs.readFileSync(full, 'utf8'))
    runJob(payload)
    fs.renameSync(full, path.join(doneDir, file))
    console.log(`[queue-worker] done ${file}`)
  } catch (err) {
    console.error(`[queue-worker] failed ${file}: ${String(err?.message || err)}`)
    fs.renameSync(full, path.join(deadDir, file))
  }
}

setInterval(processOne, pollMs)
console.log(`[queue-worker] started queueDir=${queueDir} pollMs=${pollMs}`)
