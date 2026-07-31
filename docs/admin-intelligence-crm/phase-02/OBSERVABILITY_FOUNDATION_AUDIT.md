# Observability Foundation Audit

## Reusable patterns elsewhere

- `x-request-id` / correlation in MRA EIS HTTP helpers
- AccountingV2 audit trail with correlationId
- `AdminAuditLog` for admin actions

## Phase 2

| Helper | Purpose |
|--------|---------|
| `lib/admin/correlation.js` | `createCorrelationId()`, read from headers |
| `lib/admin/auditAdminAction.js` | Thin wrapper to write AdminAuditLog (opt-in) |
| Client | Propagate correlation on adminApi |

Do not build a new APM product. Foundation helpers only.
