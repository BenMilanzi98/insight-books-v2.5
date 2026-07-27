# Phase 2 Readiness — Tenants / Users / RBAC / Settings / Support / Entitlements

**Status:** **Production-ready for Phase 2 scope** (2026-07-27)

## Delivered

| Area | Delivery |
|------|----------|
| Tenant lifecycle | Explicit `ACTIVATE` / `SUSPEND` / `REACTIVATE` / `ARCHIVE` via `/api/admin/tenants/[id]/lifecycle` |
| Soft archive | `/api/admin/tenants/delete` archives only — no hard delete, no subscription wipe |
| Tenant UI | Rewritten on admin design system with mobile cards, support-access start, lifecycle confirms |
| User security actions | Real DB updates for lock/unlock/suspend/resetPassword/revokeSessions; **password never returned** |
| Super Admin protection | `lib/admin/superAdminProtection.js` blocks locking/removing final active Super Admin |
| Support access | API + banner + start from tenant list (reason ≥ 8 chars, expiry) |
| Global settings | Persisted `PlatformGlobalSettings`; UI loads/saves via API; secrets masked |
| Feature entitlements | `PlatformFeatureEntitlement` model + API + `/insightbooks/feature-entitlements` page |
| RBAC | `systemAdmin.*` enforced on tenants, users, settings, support-access, entitlements |
| Nav | Feature Entitlements under Configuration |

## Tests

```bash
npx vitest run test/systemAdmin
```

Includes `test/systemAdmin.phase2.test.js` (Super Admin guard, entitlements, soft-archive, settings UI wiring).

## Exit criteria met

1. Explicit tenant lifecycle commands (no generic status setter for control-plane UI).  
2. Soft-archive only for tenant “delete”.  
3. User lock / unlock / password-reset-required / session revoke.  
4. Final Super Administrator protection.  
5. Support access with reason, expiry, real actor audit.  
6. Global settings persisted with secret masking.  
7. Feature entitlement overrides without data deletion.  

## Remaining (later phases / backlog)

- Full SoD matrices for every admin mutation route.  
- Deep tenant detail tabs (billing/entitlements/audit) as dedicated routes.  
- Email delivery of password-reset links (token stored; outbound email wiring optional).  
