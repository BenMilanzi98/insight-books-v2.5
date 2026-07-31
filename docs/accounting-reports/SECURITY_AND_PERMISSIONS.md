# Security and Permissions

## Permission model

`ACCOUNTING_PERMISSIONS` (`lib/accountingV2/permissions.js`) gained the
Phase 7 report set: `reports.view`, `reports.viewTrialBalance`,
`reports.viewStatements`, `reports.viewGeneralLedger`,
`reports.viewReceivables`, `reports.viewPayables`, `reports.viewInventory`,
`reports.viewPayroll`, `reports.viewAssets`, `reports.viewLoans`,
`reports.viewTax`, `reports.viewEquity`, `reports.viewIntegrity`,
`reports.viewDrillDown`, `reports.export`, `reports.review`,
`reports.approve`, `reports.snapshot`, `reports.rebuildCache`.

`reportPermissions.js` maps each report type to acceptable permissions.
Sensitive separation is deliberate: **PAYROLL** requires
`reports.viewPayroll`/`payroll.view` and **EQUITY** requires
`reports.viewEquity`/`capital.view` — neither is reachable through generic
`reports.view` (tested: a user with only the generic permission is denied).
Approval requires a distinct permission from generation (separation of
duties), and role resolution grants admins/owners full sets while restricting
staff roles.

## Server-side enforcement

Every route resolves the session and business context via `requireApiContext`
and checks permissions server-side — menu visibility is never the control.
Report generation, drill-down, export, cache and workflow routes each declare
their own requirement (see REPORT_API.md).

## Tenant isolation

Every query path requires business context: canonical where-clauses embed
`tenantId` in both the legacy and V2 branches; drill-down rejects envelopes
whose business differs from the caller's context; runs, snapshots and cache
keys are tenant-scoped; there is no raw client-supplied SQL anywhere in the
engine. Tests cover cross-business report isolation (identical seed in two
tenants produce independent results; T2 report contains no T1 accounts),
cross-business drill-down rejection, and tenant-scoped cache keys.

Audit logging (below, OBSERVABILITY_GUIDE.md) records every generation,
export, approval and cache rebuild with user and business.
