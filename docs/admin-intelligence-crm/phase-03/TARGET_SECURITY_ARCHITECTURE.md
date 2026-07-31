# Target Security Architecture — Admin Control Plane

**Status:** Locked for Phase 3 implementation  
**Date:** 2026-07-28

## Decision equation

```text
AuthorisationDecision =
  AuthenticatedActor
  + ActiveRoleAssignments
  + PermissionGrants
  + Resource + Action
  + RequestedScope
  + ResourceAttributes + ActorAttributes
  + SupportAccessContext + ImpersonationContext
  + FeatureFlag + SoD + RecordState
```

## Outcomes

`ALLOW` · `DENY` · `ALLOW_READONLY` · `ALLOW_MASKED` · `ALLOW_AGGREGATE_ONLY` · `REQUIRE_APPROVAL` · `REQUIRE_STEP_UP` · `REQUIRE_SUPPORT_CONTEXT` · `REQUIRE_TENANT_SELECTION`

## Planes

| Plane | Authority |
|-------|-----------|
| Platform Admin (`/insightbooks`, `/api/admin`) | This architecture |
| Tenant app + SecV2 | Unchanged; support entry gated by platform policy |

## Principles

1. Default deny  
2. Least privilege  
3. Server-side enforcement (middleware, API, service, repo, export, search, notify, workers)  
4. Explicit scope on every sensitive query  
5. Platform ≠ Tenant GL access  
6. Privilege ceiling on support/impersonation  
7. Real + effective actor on privileged audits  
8. Server field projection  
9. Cache isolation by actor + permissionVersion  
10. Immutable security audit  

## Canonical service

`lib/admin/authorization/`:

- `resolveAdminActor(request)`  
- `authorizeAdminDecision(input)`  
- `requireAdminDecision(request, input)` → 401/403 or context  
- `withAdminTenantFilter(actor, where)`  
- `projectAdminFields(resource, decision)`  

`adminHasPermission` becomes a thin adapter (boolean view of decision).

## Super Admin

Break-glass: still full access, but every decision records `breakGlass: true`. Last Super Admin protection retained. Self-escalation to Super Admin denied without dual control (Wave 3).

## System CoA

`/insightbooks/chart-of-accounts` remains removed from routes policy, nav, search, notifications, command palette.
