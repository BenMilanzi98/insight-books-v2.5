# Duplicate Implementation Register

| ID | Area | Implementations | Risk | Status |
|---|---|---|---|---|
| DUP-RPT-001 | Trial Balance | `accountingV2/reporting/trialBalanceService` vs `trialBalanceReport` | Divergent totals | OPEN |
| DUP-RPT-002 | Balance Sheet | V2 financialStatementService vs balanceSheetService | Divergent equity/capital | OPEN |
| DUP-RPT-003 | P&L | V2 vs incomeStatementService | Expense rollup drift | OPEN |
| DUP-RPT-004 | Cash Flow | V2 vs cashFlowService | Classification drift | OPEN |
| DUP-GL-001 | General Ledger UI | general-ledger-v2 vs legacy general-ledger | Operator confusion | CLOSED/REMEDIATED (2026-07-24) — fresh-books: V2 GL SoT; legacy writers fail-closed; see FRESH_BOOKS_CUTOVER_EVIDENCE.md |
| DUP-BAL-001 | Account balances | Journal-line derived vs Account.balance / EquityAccount.currentBalance | CAP-002 class | MITIGATED IN UI ROLLUP; data residual OPEN |
| DUP-POST-001 | Posting | executePosting vs residual legacy writers | Double post | PARTIALLY CLOSED (guards + tests) |

## Rule

One canonical path per concern. Duplicates must be removed or hard-gated behind read-only legacy flags.
