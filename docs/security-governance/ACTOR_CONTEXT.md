# Actor Context

Canonical builder: `lib/securityGovernance/domain/actorContext.js`.

## Rules

- Never trust client-supplied actor JSON.
- Build only from verified session user, service account verification, or signed job envelope.
- Preserve `authenticatedUserId`, `effectiveUserId`, and `impersonatorUserId` separately during impersonation.
- Include businessId, membership, scopes, MFA status, request/correlation IDs.

## API

`GET /api/security-governance/actor` returns a safe projection (no permission dump of secrets).
