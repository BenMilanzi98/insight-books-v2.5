# Current Module Catalogue Audit

**Finding:** No canonical Product Analytics module catalogue. Closest seeds are tenant RBAC modules + nav.

| Source | Class | Path |
|--------|-------|------|
| `permissionModules` | REUSE_WITH_RECONCILIATION | `lib/permissionsMap.js` |
| Tenant Sidebar Features | REUSE_WITH_RECONCILIATION | `components/Sidebar/Sidebar.js` |
| Admin intelligence nav | NOT_APPLICABLE as taxonomy | Admin control-plane nav ≠ product modules |
| Product Analytics module codes | NOT_FOUND | — |

## Repo-backed module candidates (seed for Wave 1)

`dashboard`, `sales` (POS), `invoices`, `quotations`, `clients`, `inventory`, `purchases`, `suppliers`, `expenses`, `payments`, `accounting`, `generalLedger`, `journalEntries`, `accounts`, `trialBalance`, `reports`, `hr`, `payroll`, `leave`, `budgets`, `financialPlanning`, `assets`, `rentals`, `tax`/`taxManagement`, `bankReconciliation`, `equity`, `accountingClose`, `eis`, `users`, `roles`, `settings`, `branches`

**Disposition:** Wave 1 creates versioned Module Catalogue from these codes; PRD-only modules (if absent in repo) → `NOT_APPLICABLE`.
