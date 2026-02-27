# Release Management

## Branching
- `main` is always deployable.
- All changes merged through pull requests with CI passing.

## Required Gates
1. Web build passes.
2. Bot tests pass.
3. Security workflow passes for dependency and static analysis.
4. Production deploy is manual approval (workflow dispatch).

## Deployment
- Use `scripts/deploy-static.sh` for website deploys.
- Keep `/var/www/greyhourrp/content` untouched during static deploy.
- Verify with `npm run health:full` after deploy.

## Rollback
- Use `scripts/rollback-static.sh /var/www/greyhourrp latest`.
- Re-validate health and announce rollback in incident channel.
