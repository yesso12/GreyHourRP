# Access Control Policy

## Principles
- Least privilege by default.
- Role-based access mapped to real operators.
- All admin actions must be attributable.

## Admin Roles
- `owner`: full control including user/role changes.
- `editor`: content and Discord announcement management.
- `ops`: status, mods, operational controls.

## Authentication Requirements
- Username/password login via protected admin endpoints.
- Credentials must not be shared.
- Rotate credentials quarterly or on staff change.

## Authorization Source of Truth
- `/etc/greyhourrp-admin-roles.json`
- Changes are owner-only and logged.

## Review Process
- Monthly role review.
- Immediate access revocation during offboarding.
