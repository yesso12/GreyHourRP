# SLOs and Error Budgets

## Service Level Objectives
- Website availability (monthly): `99.9%`
- Admin API availability (monthly): `99.9%`
- Discord bot command success rate (monthly): `99.5%`
- P95 API latency for `/api/admin/*`: `< 500ms`

## Error Budgets
- Website/Admin API monthly downtime budget at 99.9%: `43m 49s`
- Bot command error budget at 99.5%: `3h 39m`

## Alert Thresholds
- Availability drops below objective over rolling 24h.
- Command error rate > `5%` for 15m.
- API p95 latency > `800ms` for 15m.
- Queue backlog above configured threshold.

## Synthetic Monitoring
- External synthetic checks run every 5 minutes via:
  - `.github/workflows/synthetic-monitor.yml`
- Checks:
  - Website root
  - Public content status JSON
  - Public live telemetry endpoints
  - Optional admin authenticated checks
  - Optional bot metrics endpoint
- On failure, webhook notification is sent when `SYNTHETIC_ALERT_WEBHOOK_URL` is configured.

## Reporting Cadence
- Weekly reliability review.
- Monthly SLO scorecard and budget burn review.
