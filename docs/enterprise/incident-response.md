# Incident Response Runbook

## Severity Levels
- `SEV-1`: Full outage/security breach/data loss risk.
- `SEV-2`: Major feature unavailable or degraded.
- `SEV-3`: Minor degraded behavior/workaround available.

## First 15 Minutes
1. Acknowledge alert and assign Incident Commander.
2. Create incident channel/thread and timeline.
3. Assess blast radius (web, admin API, bot).
4. Stabilize first (rollback/restart/rate-limit), then diagnose.

## Communication Template
- What happened
- Impacted users/systems
- Current mitigation
- Next update timestamp (every 15 minutes for SEV-1)

## Recovery Checklist
1. Confirm user-facing recovery via health checks.
2. Keep monitoring elevated for 60 minutes.
3. Record exact start/end times and root cause.
4. Publish postmortem within 48 hours.

## Postmortem Minimums
- Trigger
- Root cause
- Why safeguards missed it
- Corrective actions with owners/due dates
