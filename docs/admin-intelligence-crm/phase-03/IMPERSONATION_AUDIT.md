# Impersonation Audit

| Plane | Finding | Class |
|-------|---------|-------|
| Platform support access | Tenant context bookkeeping only | EXTEND ≠ impersonation |
| Tenant SecV2 `actorContext` | Separate impersonator fields | KEEP separate |
| Real + effective on AdminAuditLog | Partial (adminId only often) | AUDIT_GAP |
| MRA EIS adminContext | Scaffold fields | EXTEND |

**Principle:** Impersonation/support never exceeds real actor permission ∩ support profile ∩ target role. Zero unaudited impersonation.

**Target:** Explicit `AdminActorContext { realAdminId, effectiveTenantId, supportSessionId, impersonating }` on every privileged action.
