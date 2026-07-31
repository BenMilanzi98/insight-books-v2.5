# Security and Permissions

Module key: `financialPlanning` (see `lib/permissionsMap.js` and `lib/financialPlanning/permissions.js`).

Enforcement:

- Server-side via `guardAccountingRoute` + `guardPlanningRoute`
- Feature flag `financialPlanningV2Enabled`
- All Prisma queries scoped by `tenantId` / `businessId`
- Cross-business IDs → `CrossTenantPlanningError`
- Approved forecast/budget immutability in services
- AI suggestions cannot approve forecasts
