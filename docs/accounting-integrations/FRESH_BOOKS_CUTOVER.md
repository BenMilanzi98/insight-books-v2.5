# Fresh Books V2-Only Cutover

## Decisions

- NEW_ENGINE is the only posting path. LEGACY / SHADOW / DUAL_COMPARE are removed from runtime.
- No historical Transaction → JournalEntry migration.
- Ledgers start at **zero** (no opening-balance seed).
- All live `JournalEntry` rows and V2 event/shadow/repair/report artifacts are wiped.
- `Transaction` / `TransactionLine` remain in the database as an **unused archive**. The app must not read or write them.

## One-time run order

1. Deploy code that posts only via `executePosting` and reads GL only from `JournalEntry` (`architectureVersion = ACCOUNTING_V2`).
2. Take a DB backup.
3. Run:

```bash
node scripts/fresh-books-v2-reset.js --confirm
```

4. Smoke-test: post an expense/invoice → row in `AcctV2EventRegistry` + `JournalEntry`; GL/TB show that entry only.
5. Confirm no operational path calls `postGlEntry` or `prisma.transaction.create`.

## What the reset wipes

- Shadow journals / comparisons
- Event registry, posting attempts, outbox
- Repair trail, report cache/snapshots/runs
- Opening-balance batches, ledger balance projections, journal sequences
- All `JournalEntry` / `JournalEntryLine`
- `Account.balance` → 0; `AccountBalance` / `AccountBalanceHistory` cleared

## What it keeps

- `Transaction` / `TransactionLine` (archive)
- Chart of accounts, periods/calendar, tenants
- Operational documents (invoices, expenses, sales, etc.)

## Consequences

- P&L / Balance Sheet are meaningful **from cutover forward only**.
- Existing operational documents keep their business data but lose historical GL linkage until new V2 posts occur.
