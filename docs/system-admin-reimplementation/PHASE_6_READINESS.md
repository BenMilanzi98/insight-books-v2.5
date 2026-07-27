# Phase 6 Readiness — Search, Reports, Imports/Exports, Hardening

**Status:** Production-ready for foundational control-plane scope (post residual hardening)

## Delivered

### Search
- Permission-aware `/api/admin/search` + `AdminGlobalSearch` in AdminShell (debounced)

### Reports
- `/api/admin/platform-reports` summaries + optional `?format=csv` with `preventFormulaInjection` (capped)
- UI: `/insightbooks/reports` (tenants / subscriptions / affiliates)
- Legacy `/api/admin/reports` → **410** pointing to platform-reports

### Imports / exports
- Dry-run only: `lib/admin/importDryRun.js` + `/api/admin/imports/dry-run` + `/insightbooks/imports`
- Real users export: `/api/admin/users/export` (prisma + formula injection guard + `users.export` permission)
- `lib/admin/exportSafety.js` wired into production export paths

### Hardening
- Retired/replaced mock APIs: security sessions/monitoring, performance, metrics, backups, updates, users/roles
- Removed `Math.random` theatre from dashboard stats + analytics geo
- Test matrix: `test/systemAdmin*.test.js` including `systemAdmin.residualHardening.test.js`

## Residual (accepted)
- Dry-run imports do **not** write (by design); commit path is a future ops feature
- Full cosmetic redesign of every legacy admin form remains incremental
- Document generation (PDF packs) not in scope
