# Phase 1 Readiness — Foundation, Shell & CoA

**Status:** Delivered (with ongoing UI polish)

## Delivered

- System Admin permission catalog (`lib/admin/permissions.js`) with `systemAdmin.*` keys and Super Admin bypass.
- Admin navigation config (`lib/admin/adminNav.js`) aligned to target IA — no Chart of Accounts nav item.
- `AdminShell` + notice banner components for control-plane chrome.
- System Chart of Accounts UI removed: `/insightbooks/chart-of-accounts` redirects to dashboard with `notice=coa-removed`.
- System-coa **APIs retained** for ops/seeding (`/api/admin/system-coa*`).
- Smoke tests: `test/systemAdmin.shellNav.test.js`, `test/systemAdmin.coaRouteRemoval.test.js`.

## Exit criteria met

| Criterion | Evidence |
|-----------|----------|
| CoA UI gone from admin | Redirect page + nav exclusion |
| Permission catalog exists | `SYSTEM_ADMIN_PERMISSIONS` |
| Shell/nav foundation | `AdminShell`, sectioned nav |
| Tenant CoA untouched | Remains at `/chart-of-accounts` |

## Residual

- Not every legacy admin API yet enforces granular `systemAdmin.*` (incremental).
- Full visual redesign of every admin form is out of Phase 1 scope.
