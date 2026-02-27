# Disaster Recovery

## Targets
- `RPO`: 24 hours (max tolerated data loss)
- `RTO`: 60 minutes (target recovery time)

## Backup Scope
- Website content JSON in `/var/www/greyhourrp/content`
- Bot runtime state in `discord-bot/data`
- Admin roles file (`/etc/greyhourrp-admin-roles.json`)

## Backup Policy
- Daily encrypted backup snapshots.
- Retain 14 daily + 8 weekly snapshots.
- Verify restore integrity weekly.

## Recovery Steps
1. Restore latest known-good content + bot state backup.
2. Restart `greyhourrp-admin-api` and `greyhourrp-discord-bot`.
3. Run `npm run health:full` and `discord-bot` smoke check.
4. Validate admin login and one write operation.

## Validation Drill
- Run full DR simulation monthly in staging.

## Automated Restore Drill
- Optional weekly restore drill timer:
  - `greyhourrp-restore-drill.timer`
- Script:
  - `scripts/restore-drill.sh`
- Behavior:
  - Extracts latest backup archive to a drill workspace
  - Validates expected folders and critical JSON files
  - Emits automation alert on success/failure when webhook is configured
