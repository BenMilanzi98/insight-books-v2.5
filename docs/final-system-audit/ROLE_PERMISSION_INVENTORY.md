# Role & Permission Inventory

## Findings

- Permissions are enforced in API handlers and domain services (not menu visibility alone) — **intent**.
- Security governance module adds maker-checker, sessions, API keys, audit (`lib/securityGovernance`).
- MRA EIS permissions live under `SYSTEM_EIS_PERMISSIONS` (certification / pilot / rollout / hypercare).
- Auditor read-only posture is tested in security-governance helpers (`assertMakerChecker` / self-approval denial).

## Classification

| Area | Status |
|---|---|
| Core RBAC matrix completeness | PARTIALLY_IMPLEMENTED |
| Every API permission check | COMPLETE_REQUIRES_TESTING |
| Auditor read-only | COMPLETE_REQUIRES_TESTING |
| Cross-tenant denial | COMPLETE_REQUIRES_TESTING (unit/integration); prod pen-test PENDING |

See `ROLE_PERMISSION_AUDIT.md` and `MULTI_TENANT_SECURITY_AUDIT.md`.
