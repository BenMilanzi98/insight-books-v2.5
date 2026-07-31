# API Inventory

| Field | Value |
|---|---|
| Total route handlers | **740** |
| Generated | 2026-07-23T10:22:17.109Z |

Full paths: inventory artifact `apis[]`.

## Routes by namespace (top 50)

| Namespace | Routes | Status |
| --- | --- | --- |
| admin | 84 | COMPLETE_REQUIRES_TESTING |
| mra-eis | 40 | COMPLETE_REQUIRES_TESTING |
| reports | 34 | COMPLETE_REQUIRES_TESTING |
| accounting-v2 | 33 | COMPLETE_REQUIRES_TESTING |
| payroll | 18 | COMPLETE_REQUIRES_TESTING |
| employees | 16 | COMPLETE_REQUIRES_TESTING |
| expenses | 16 | COMPLETE_REQUIRES_TESTING |
| invoices | 16 | COMPLETE_REQUIRES_TESTING |
| purchases | 16 | COMPLETE_REQUIRES_TESTING |
| stock | 16 | COMPLETE_REQUIRES_TESTING |
| dashboard | 15 | COMPLETE_REQUIRES_TESTING |
| tenant | 15 | COMPLETE_REQUIRES_TESTING |
| eis | 14 | COMPLETE_REQUIRES_TESTING |
| affiliate | 13 | COMPLETE_REQUIRES_TESTING |
| auth | 13 | COMPLETE_REQUIRES_TESTING |
| clients | 13 | COMPLETE_REQUIRES_TESTING |
| bank-reconciliation | 12 | COMPLETE_REQUIRES_TESTING |
| coa-v2 | 12 | COMPLETE_REQUIRES_TESTING |
| financial-planning | 12 | COMPLETE_REQUIRES_TESTING |
| accounts | 10 | COMPLETE_REQUIRES_TESTING |
| attendance | 10 | COMPLETE_REQUIRES_TESTING |
| equity-management | 10 | COMPLETE_REQUIRES_TESTING |
| chart-of-accounts | 9 | COMPLETE_REQUIRES_TESTING |
| quotations | 9 | COMPLETE_REQUIRES_TESTING |
| users | 9 | COMPLETE_REQUIRES_TESTING |
| payments | 8 | COMPLETE_REQUIRES_TESTING |
| rentals | 8 | COMPLETE_REQUIRES_TESTING |
| sales | 8 | COMPLETE_REQUIRES_TESTING |
| bf | 7 | COMPLETE_REQUIRES_TESTING |
| hr-reports | 7 | COMPLETE_REQUIRES_TESTING |
| security-governance | 7 | COMPLETE_REQUIRES_TESTING |
| tax-types | 7 | COMPLETE_REQUIRES_TESTING |
| accounting-close | 6 | COMPLETE_REQUIRES_TESTING |
| assets | 6 | COMPLETE_REQUIRES_TESTING |
| cron | 6 | COMPLETE_REQUIRES_TESTING |
| loan-readiness | 6 | COMPLETE_REQUIRES_TESTING |
| payment-accounts | 6 | COMPLETE_REQUIRES_TESTING |
| roles | 6 | COMPLETE_REQUIRES_TESTING |
| subscription | 6 | COMPLETE_REQUIRES_TESTING |
| system | 6 | COMPLETE_REQUIRES_TESTING |
| budgets | 5 | COMPLETE_REQUIRES_TESTING |
| cogs | 5 | COMPLETE_REQUIRES_TESTING |
| mobile-app | 5 | COMPLETE_REQUIRES_TESTING |
| pos | 5 | COMPLETE_REQUIRES_TESTING |
| suppliers | 5 | COMPLETE_REQUIRES_TESTING |
| analytics | 4 | COMPLETE_REQUIRES_TESTING |
| branches | 4 | COMPLETE_REQUIRES_TESTING |
| capital-account | 4 | COMPLETE_REQUIRES_TESTING |
| forecasts | 4 | COMPLETE_REQUIRES_TESTING |
| general-ledger | 4 | COMPLETE_REQUIRES_TESTING |

## Critical API findings

1. **Canonical posting API**: `/api/accounting-v2/posting-engine` → `executePosting` / `previewPosting`.
2. **V2 reports**: `/api/accounting-v2/reports/*` derive from posted journal lines via ledger query.
3. **Legacy reports**: `/api/reports/*` (**34** routes) still use `trialBalanceReport`, `balanceSheetService`, `incomeStatementService` — **DUPLICATED** financial path.
4. **MRA EIS**: **40** routes — programme controls ready; production enablement **BLOCKED**.
5. **Cron**: **6** routes — worker/outbox dispatcher still incomplete for AcctV2 outbox.

## Security baseline expectation (not fully certified)

Every mutating route must authenticate, authorize, and scope by business/tenant. Automated API security suite is **PARTIAL** — see `API_SECURITY_AUDIT.md`.
