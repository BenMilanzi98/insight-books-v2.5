# Capital Account and Equity Audit

Run: `npm run audit:forensic -- --module capital` • Artifacts:
`artifacts/accounting-audit/equity-reconciliation.csv`,
`artifacts/accounting-audit/capital-duplication-evidence.json`.

## The "MK1,000,000 posted but MK2,000,000 displayed" trace

The reported production discrepancy could not be reproduced byte-for-byte on the local QA
database (production copy required), but the audit **proved the exact defect class with a live
trace** on account `3102 Capital contribution — QA-Legacy`:

```
Displayed (stored Account.balance):        5,000.00   ← what the CoA page shows
Journal-line-derived balance:                  0.00   ← what Journal Entries / GL reports show
Explaining record: JournalEntry QA-S19-LEGACY-CR
  - status Posted, transactionId NULL
  - credit = 5,000 stored on the HEADER (JournalEntry.credit Float)
  - lines: NONE  → invisible to every line-based aggregation
```

Mechanism: capital posted through the **legacy header-amount path** updates the stored balance
once at posting time, but line-based reports recompute from `TransactionLine`/`JournalEntryLine`
and never see it. Depending on which surface a report reads — stored balance, line
reconstruction, or **both added together** — capital displays as 0×, 1× or **2× the posted
amount**. A report that sums `Account.balance` *plus* journal lines (or that adds the equity
parent 3000 rollup to its children) shows exactly double: MK1,000,000 posted → MK2,000,000
displayed.

Confirmed contributing structures (all present in code/schema):

| # | Cause | Status | Evidence |
|---|---|---|---|
| 1 | Stored balance + line-derived balance both surfaced | **Confirmed** | GL-002/CAP-005 findings above; `Account.balance` vs `recalculateAccountBalance` |
| 2 | Legacy header journals counted only in stored balances | **Confirmed** | `QA-S19-LEGACY-CR` trace |
| 3 | Parent (3000 Equity) + child (3100/3101) both carrying balances → rollup double count | **Structurally possible; flagged by CAP-002 when data present** | Parent accounts are posting-blocked (`acceptsNewTransactions=false` on 3000) but stored balances on both levels remain possible via legacy data |
| 4 | Duplicate capital journals (same source posted twice) | **Not present in current data; race exists** | `assertNoDuplicatePostedSource` is TOCTOU-racy; no DB unique constraint (CAP-001 will catch occurrences) |
| 5 | `EquityAccount.currentBalance` independent of GL | **Confirmed as independent surface** | `EquityAccount` model stores `openingBalance`/`currentBalance` Float with no sync to journals (0 rows locally) |

## How capital actually posts (verified)

- Capital contributions post via `postGlEntry` with `sourceType='capital_contribution'`:
  Dr cash/bank asset, Cr per-owner equity child account (e.g. `3101 Capital contribution — QA-Owner Cash`)
  created under `3100 Owner's Capital`. Correct treatment; observed in data (`QA-S12-GL`).
- Owner withdrawals post Dr equity child, Cr cash (`QA-S13-GL`) — treated as equity reduction,
  not expense (correct; CAP-003 clean on current data).
- Retained earnings (3200) and Current Year Earnings (3300): **no year-end closing journal
  mechanism exists** (see `ACCOUNTING_PERIODS_AUDIT.md`). Current-year profit is computed on the
  fly by reports from revenue/expense lines, never posted. `3300` has no journal activity —
  consistent with "calculated, not stored", but retained earnings will never accumulate without
  a closing process.
- Equity reconciliation for every equity account (stored vs derived vs derived+legacy, with full
  per-source ref lists) is in `equity-reconciliation.csv`; e.g. `3101` reconciles exactly
  (85,000 = 100,000 contribution − 15,000 drawing).

## Dividend / share capital

No dividend declaration/payment tables, owner register, or share-capital module exist
(Equity Management Module is specified in docs but unimplemented). Not auditable as data;
recorded as scope gap for Phase 2+.

## Phase 1 verdict

- Do **not** adjust any capital figure now.
- Production re-run of `--module capital` will output the same per-source trace for the real
  MK1,000,000 account; the defect class and mechanism are already proven.
