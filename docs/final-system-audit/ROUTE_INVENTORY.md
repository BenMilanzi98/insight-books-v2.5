# Route Inventory (UI pages)

| Field | Value |
|---|---|
| Total pages | **183** |
| Generated | 2026-07-23T10:22:17.109Z |

Full paths: `artifacts/system-audit/inventory-counts.json` → `pages[]`.

## Pages by top-level segment (top 40)

| Segment | Pages | Status |
| --- | --- | --- |
| insightbooks | 36 | COMPLETE_REQUIRES_TESTING |
| settings | 18 | COMPLETE_REQUIRES_TESTING |
| hr | 13 | COMPLETE_REQUIRES_TESTING |
| affiliate | 7 | COMPLETE_REQUIRES_TESTING |
| auth | 6 | COMPLETE_REQUIRES_TESTING |
| budget-forecast | 6 | COMPLETE_REQUIRES_TESTING |
| purchases | 6 | COMPLETE_REQUIRES_TESTING |
| stock | 5 | COMPLETE_REQUIRES_TESTING |
| journal-entries | 4 | COMPLETE_REQUIRES_TESTING |
| pos | 4 | COMPLETE_REQUIRES_TESTING |
| subscription | 4 | COMPLETE_REQUIRES_TESTING |
| budget | 3 | COMPLETE_REQUIRES_TESTING |
| eis | 3 | COMPLETE_REQUIRES_TESTING |
| suppliers | 3 | COMPLETE_REQUIRES_TESTING |
| system | 3 | COMPLETE_REQUIRES_TESTING |
| accounting | 2 | COMPLETE_REQUIRES_TESTING |
| branches | 2 | COMPLETE_REQUIRES_TESTING |
| capital-account | 2 | COMPLETE_REQUIRES_TESTING |
| chart-of-accounts | 2 | COMPLETE_REQUIRES_TESTING |
| financial-setup | 2 | COMPLETE_REQUIRES_TESTING |
| invoice | 2 | COMPLETE_REQUIRES_TESTING |
| payments | 2 | COMPLETE_REQUIRES_TESTING |
| rentals | 2 | COMPLETE_REQUIRES_TESTING |
| reports | 2 | COMPLETE_REQUIRES_TESTING |
| tax-accounts | 2 | COMPLETE_REQUIRES_TESTING |
| account | 1 | COMPLETE_REQUIRES_TESTING |
| accounting-close | 1 | COMPLETE_REQUIRES_TESTING |
| accounting-periods | 1 | COMPLETE_REQUIRES_TESTING |
| asset-management | 1 | COMPLETE_REQUIRES_TESTING |
| bank-reconciliation | 1 | COMPLETE_REQUIRES_TESTING |
| clients | 1 | COMPLETE_REQUIRES_TESTING |
| cogs | 1 | COMPLETE_REQUIRES_TESTING |
| contact | 1 | COMPLETE_REQUIRES_TESTING |
| credit-debit-notes | 1 | COMPLETE_REQUIRES_TESTING |
| customization | 1 | COMPLETE_REQUIRES_TESTING |
| dashboard | 1 | COMPLETE_REQUIRES_TESTING |
| download-app | 1 | COMPLETE_REQUIRES_TESTING |
| equity-management | 1 | COMPLETE_REQUIRES_TESTING |
| expenses | 1 | COMPLETE_REQUIRES_TESTING |
| financial-calendar-v2 | 1 | COMPLETE_REQUIRES_TESTING |

## V2-first pages (verified present)

- `/general-ledger-v2`
- `/financial-calendar-v2`
- `/reports-v2`
- `/chart-of-accounts/governance`
- `/bank-reconciliation`
- `/equity-management`
- `/accounting-close`
- `/financial-planning`
- `/loan-readiness`
- `/security-governance`
- `/system/accounting-architecture`
- `/system/accounting-posting-engine`
- `/system/accounting-repair`
- `/settings/integrations/mra-eis/*`

## Finding

Legacy and V2 UI surfaces coexist. Operators can still open legacy GL / reports paths that may not use Accounting V2 journal lines — **DUPLICATED** risk (see `DUPLICATE_IMPLEMENTATION_REGISTER.md`).
