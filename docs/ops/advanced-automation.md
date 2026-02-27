# Advanced Automation (Items 1-15)

This document maps each requested advanced item to concrete automation in this repo.

## 1) Auto rollback by SLO
- Script: `scripts/slo-rollback.sh`
- Trigger: `scripts/systemd/greyhourrp-slo-guard.timer` (every 5 minutes)
- Behavior: runs repeated smoke probes; if failures breach threshold, rolls back to latest static backup and re-verifies.

## 2) Canary deploys
- Script: `scripts/canary-promote.sh`
- CI/CD integration: `.github/workflows/deploy-static.yml`
- Behavior: deploy candidate to canary dir, smoke test, then promote to production and smoke test again.

## 3) Real synthetic monitoring
- Workflow: `.github/workflows/synthetic-monitor.yml`
- Cadence: every minute.
- Multi-probe matrix: `edge-a`, `edge-b`, `edge-c`.
- Checks: core public routes, public APIs, admin APIs (if auth configured), bot metrics, immutable asset caching.

## 4) Frontend RUM dashboard
- Rollup script: `scripts/rum-rollup.sh`
- Output: `/var/www/greyhourrp/content/rum-dashboard.json`
- Timer: `scripts/systemd/greyhourrp-rum-rollup.timer`

## 5) Alert routing by severity
- Alerting script: `scripts/systemd/notify-automation.sh`
- Severity lanes:
  - `P1`: `slo-guard`, `self-heal`, `health-check`, `service-guard`, `integrity-check`
  - `P2`: all other failures
- Env routes:
  - `AUTOMATION_ALERT_WEBHOOK_URL_P1`
  - `AUTOMATION_ALERT_WEBHOOK_URL_P2`
  - fallback `AUTOMATION_ALERT_WEBHOOK_URL`

## 6) Self-healing playbooks
- Script: `scripts/self-heal.sh`
- Behavior:
  - classifies failure category
  - rebuilds and redeploys
  - emits provenance
  - enqueues ops/RUM refresh jobs

## 7) Drift detection
- Script: `scripts/drift-detect.sh`
- Timer: `scripts/systemd/greyhourrp-drift-detect.timer`
- Baseline mode: `npm run drift:baseline`
- Check mode: `npm run drift:check`

## 8) Policy-as-code guardrails
- Script: `scripts/policy-gate.sh`
- Enforces:
  - forbidden public content phrases (including loadout export/item catalog/live players)
  - no source maps in dist
  - static shell budget and bundle budget
- CI/CD usage: CI and deploy workflows.

## 9) Queue-based background jobs
- Worker: `scripts/queue-worker.mjs`
- Queue helper: `scripts/queue-enqueue.sh`
- Service: `scripts/systemd/greyhourrp-queue-worker.service`
- Current job types:
  - `rum_rollup`
  - `build_ops_board`

## 10) Backup verification / restore test
- Script: `scripts/backup-verify.sh`
- Timer: `scripts/systemd/greyhourrp-backup-verify.timer`
- Includes archive integrity check + restore drill execution.

## 11) Immutable artifacts + provenance
- Script: `scripts/provenance.sh`
- Build command: `npm run build:release`
- Output:
  - `dist/provenance/manifest.sha256`
  - `dist/provenance/release-meta.json`
  - optional signature when `PROVENANCE_SIGNING_KEY` is set.

## 12) Blue/green for Admin API
- Helper script: `scripts/admin-api-bluegreen.sh`
- Supports:
  - `status`
  - `promote-blue`
  - `promote-green`
- Expects blue/green systemd services to be present on host.

## 13) Capacity/cost autoscaling rules
- Policy script: `scripts/autoscale-policy.sh`
- Timer: `scripts/systemd/greyhourrp-autoscale-policy.timer`
- Output decision: `/var/lib/greyhourrp-autoscale/decision.json`

## 14) Security automation hardening
- Script: `scripts/security-hardening-check.sh`
- Workflow integration: `.github/workflows/security.yml`
- Existing + new controls:
  - npm audit
  - CodeQL
  - gitleaks (separate workflow)
  - policy gate
  - optional security header checks against production URL

## 15) Unified ops board
- Builder: `scripts/ops-board-build.sh`
- Output: `/var/www/greyhourrp/content/ops-board.json`
- Timer: `scripts/systemd/greyhourrp-ops-board.timer`
- Combines status + site flags + RUM + automation capability state.

## Recommended enablement
1. Install/refresh host automation units:
```bash
sudo bash scripts/systemd/install-host-automation.sh
```
2. Enable optional weekly backup verification:
```bash
sudo ENABLE_BACKUP_VERIFY_TIMER=true bash scripts/systemd/install-host-automation.sh
```
3. Baseline drift after host is in desired state:
```bash
sudo npm run drift:baseline
```
