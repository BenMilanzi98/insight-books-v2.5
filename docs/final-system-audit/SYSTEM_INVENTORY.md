# System Inventory

| Field | Value |
|---|---|
| Generated | 2026-07-23T10:22:17.109Z |
| Source | `artifacts/system-audit/inventory-counts.json` |

## Counts

| Category | Count | Classification |
| --- | --- | --- |
| Pages | 183 | COMPLETE_REQUIRES_TESTING |
| API routes | 740 | COMPLETE_REQUIRES_TESTING |
| Prisma models | 307 | COMPLETE_REQUIRES_TESTING |
| Migrations | 124 | COMPLETE_REQUIRES_TESTING |
| Test files | 141 | COMPLETE_REQUIRES_TESTING |
| Lib modules | 20 | COMPLETE_REQUIRES_TESTING |
| Cron jobs | 6 | PARTIALLY_IMPLEMENTED |

## V2 / module API namespaces

| Prefix | Routes | Status |
| --- | --- | --- |
| /api/accounting-v2 | 33 | COMPLETE_REQUIRES_TESTING |
| /api/coa-v2 | 12 | COMPLETE_REQUIRES_TESTING |
| /api/bank-reconciliation | 12 | COMPLETE_REQUIRES_TESTING |
| /api/equity-management | 10 | COMPLETE_REQUIRES_TESTING |
| /api/accounting-close | 6 | COMPLETE_REQUIRES_TESTING |
| /api/financial-planning | 12 | COMPLETE_REQUIRES_TESTING (advisory — no GL) |
| /api/loan-readiness | 6 | COMPLETE_REQUIRES_TESTING (advisory — no GL) |
| /api/security-governance | 7 | COMPLETE_REQUIRES_TESTING |
| /api/mra-eis | 40 | CONTROLS_READY_PRODUCTION_BLOCKED |
| /api/reports (legacy) | 34 | DUPLICATED / LEGACY risk |
| /api/cron | 6 | PARTIALLY_IMPLEMENTED |

## Domain packages (`lib/`)

- `accountingAudit`
- `accountingClose`
- `accountingEngine`
- `accountingV2`
- `bankReconciliation`
- `coaMigration`
- `coaV2`
- `equityManagement`
- `financialPlanning`
- `loanReadiness`
- `mraEis`
- `payrollEngine`
- `performanceReliability`
- `postingRules`
- `productionCutover`
- `qa`
- `reportingEngine`
- `securityGovernance`
- `setupWizard`
- `stock`

## Classification legend

COMPLETE_AND_VERIFIED · COMPLETE_REQUIRES_TESTING · PARTIALLY_IMPLEMENTED · DISCONNECTED · INCORRECT · DUPLICATED · LEGACY · UNSAFE · MISSING · BLOCKED · NOT_APPLICABLE
