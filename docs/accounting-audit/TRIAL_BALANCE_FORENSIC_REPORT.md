# Trial Balance Forensic Audit

Run: `npm run audit:forensic -- --module trial-balance` • Artifacts:
`artifacts/accounting-audit/independent-trial-balance.csv`,
`artifacts/accounting-audit/trial-balance-per-tenant.csv`.

## How the Trial Balance module works (verified in `lib/trialBalanceReport.js`)

- Source: posted `Transaction` lines (`status: 'posted'`, exact casing) **plus** posted
  `JournalEntry` lines (`status: 'Posted'`, exact casing) with `transactionId: null`
  (excludes mirrors) — grouped per account via DB-side `groupBy`, then rolled up to
  merge-survivor accounts (`lib/accountMergeRollup.js`).
- Date filter: `Transaction.date` vs `JournalEntry.entryDate` (different semantics if
  `entryDate` is null — those rows drop out of TB entirely).
- Tenant filter: applied on both queries. Branch filter optional.
- Stored `Account.balance` is **not** used by TB — good.
- Legacy header-amount `JournalEntry` rows (no lines) are **invisible** to TB.

## Independent reconstruction (current DB)

| Tenant | Accounts w/ activity | Debits | Credits | Diff | Balanced |
|---|---|---|---|---|---|
| QA-Accounting | 12 | 711,000.00 | 711,000.00 | 0.00 | ✔ |
| Other 4 tenants | 0 | 0 | 0 | 0 | ✔ |

TB-001: no imbalance on current data. Per-account detail in `independent-trial-balance.csv`.

## Why the Trial Balance can fail in production (ranked root-cause hypotheses)

| Rank | Cause | Class | Evidence |
|---|---|---|---|
| 1 | **Legacy header-amount journals** — a Dr header row and its Cr pair excluded from line aggregation; if only one of the pair was captured (observed shape allows single rows), TB misses one side entirely | Confirmed mechanism | JRN-009 rows exist; TB reads lines only |
| 2 | **Status-casing drift** — TB matches exact `'posted'`/`'Posted'`; rows written with other casing vanish from TB but remain in stored balances | Confirmed code asymmetry | `trialBalanceReport.js:60,84` vs `accountBalanceService.js:35` (three casings) |
| 3 | **Unbalanced individual journals** — engine validates balance, but `skipDuplicateCheck`/direct `prisma.transaction.create` bypasses exist in scripts/legacy paths | Structural | posting-path inventory |
| 4 | **Duplicate journals** (TOCTOU race on duplicate check) | Structural | `accountingMappingRules.js:320` |
| 5 | **Parent-child double counting** in *presentation* layers that add subtree rollups to leaf rows (TB itself groups by leaf account; CoA display rollups differ) | Hazard flagged (TB-003) | `coaChartRollup.js` family |
| 6 | **`entryDate` null on JournalEntry** — row drops out of TB date window | Structural (schema nullable) | schema W6 |
| 7 | Currency/precision — lines are Decimal(18,2), aggregation in cents in audit engine; app-side uses `parseFloat` chains | Minor risk | `coaMoney.js`, services |

The audit engine reproduces TB independently with integer-cent math, so any production
difference between module output and `independent-trial-balance.csv` isolates the defect to
the module's filters rather than the data.
