# General Ledger Audit

Run: `npm run audit:forensic -- --module ledger` • Artifacts:
`artifacts/accounting-audit/general-ledger-reconciliation.csv`,
`artifacts/accounting-audit/account-balance-differences.csv`.

## How the General Ledger module actually works

- The GL is **derived from journal lines of both ledgers**: `TransactionLine` (posted
  `Transaction`) plus `JournalEntryLine` (posted `JournalEntry` where `transactionId IS NULL`).
  Core services: `lib/officialLedgerEngine.js`, `lib/accountBalanceService.js`,
  `lib/reportGlAccountLines.js`.
- **In addition**, a stored snapshot `Account.balance` is incrementally maintained on every
  posting by `updateAccountBalanceOnTransaction` (`lib/accountBalanceService.js:178`) — a
  read-modify-write (`newBalance = balance + change`) without database-level serialization,
  so concurrent postings can lose updates.
- Draft journals are excluded (status filters), reversals are included as offsetting entries
  (original + reversal both posted; nets to zero).
- Normal-balance handling: `Asset|Expense → debit-normal`, `Liability|Equity|Revenue → credit-normal`,
  fallback to `normalBalance` — consistent across `accountBalanceService` and the audit engine.

## Independent reconstruction results (current DB)

538 of 540 accounts reconcile exactly. **2 accounts differ**, both fully explained by legacy
header-amount `JournalEntry` rows (JRN-009) that line-based reconstruction excludes but the
stored balance includes:

| Account | Stored | Journal-derived (lines) | Diff | Explanation |
|---|---|---|---|---|
| 1110 Cash - Main Account | −4,500.00 | −9,500.00 | +5,000.00 | Legacy header journal `QA-S19-LEGACY` (Dr 5,000, no lines) |
| 3102 Capital contribution — QA-Legacy | 5,000.00 | 0.00 | +5,000.00 | Legacy header journal `QA-S19-LEGACY-CR` (Cr 5,000, no lines) |

**This is the confirmed mechanism by which the Chart of Accounts / stored balances disagree
with line-based reports (GL, Trial Balance, statements):** amounts posted through the legacy
header-amount path exist in stored balances but are invisible to every line-based aggregation.

## Failure modes confirmed by code inspection

| # | Mechanism | Evidence |
|---|---|---|
| 1 | Stored balance drift via unserialized read-modify-write | `lib/accountBalanceService.js:253` (`newBalance = parseFloat(balance) + change`, no locking) |
| 2 | Legacy header journals excluded from line aggregation | `recalculateAccountBalance` only sums `transactionLine` + `journalEntryLine`; header `debit/credit` never read |
| 3 | Balance updates can be skipped per call | `postGlEntry({ skipBalanceUpdate: true })` leaves stored balance stale by design |
| 4 | `recalculateAccountBalance` vs `recalculateAccountBalanceFromPostedGl` disagree | The first excludes `journalEntry.transactionId != null` mirrors; the second includes them — running the two rebuild paths produces different balances when mirrors exist |
| 5 | Float arithmetic in balance math | `parseFloat` chains in `accountBalanceService.js`; ledger lines are Decimal but balance math is done in JS floats |

## Discrepancy records

Per-account rows with stored vs derived balances, line totals, and legacy header footprints are
in `general-ledger-reconciliation.csv` (all 540 accounts) and `account-balance-differences.csv`
(differences only). Cross-tenant line references: **0** (TEN-001 clean on current data).
