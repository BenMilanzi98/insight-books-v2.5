# EIS Entitlement Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Two controls

| Layer | Owner | Examples |
|---|---|---|
| Platform / System Admin | Platform | platformEnabled, tenant entitlement, sandbox/production permission, certification, emergency suspend |
| Tenant operational | Tenant admin | enable/pause, default terminal, receipt wait policy, auto-retry bounds |

## Effective capability (computed, not one Boolean)

```
EisEffectiveCapability {
  platformEnabled, tenantEntitled, tenantEntitlementStatus,
  businessOperationalEnabled, environmentAllowed, certificationApproved,
  terminalActivated, credentialsUsable, configurationCurrent, mappingsComplete,
  terminalBlocked, systemSuspended, effectiveEnabled, blockers[], warnings[]
}
```

Reuse: `eis-monthly`/`eis-yearly` + `Tenant.eisEnabled` — **fix hasEISAccess** to query EIS plans explicitly (Phase 2 G2-004).

Disablement: pause new claims → drain queue → DISABLED; **never delete** transmission history.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
