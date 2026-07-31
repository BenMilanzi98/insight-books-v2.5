# Permission Model Audit

## Catalog

`SYSTEM_ADMIN_PERMISSIONS` covers dashboard, tenants, users, settings, android, affiliates, billing, mraPlans, email, mraEntitlement, audit, security, health.

`INTEL_CRM_PERMISSION_SCAFFOLD` — keys only, default deny.

`NAV_PERMISSION_MAP` — complete for `adminNav` hrefs; unmapped hidden.

## Evaluation

`adminHasPermission`: Super Admin → true; else nested `permissions.systemAdmin.<cat>.<action>` or flat key.

## Gaps

| Gap | Class |
|-----|-------|
| Super Admin bypass (no break-glass audit) | PRIVILEGE_ESCALATION_RISK |
| No permission versioning | MISSING |
| Metric keys unused on dashboard stats | AUDIT_GAP |
| Export/report/widget fine grain incomplete | EXTEND |
| Client gate ≠ server | CLIENT_ONLY_SECURITY (documented) |

**Target:** Versioned catalogue; decision service; Super Admin as explicit break-glass with audit reason.
