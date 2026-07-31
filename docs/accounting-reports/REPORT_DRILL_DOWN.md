# Report Drill-Down

`lib/accountingV2/reporting/reportDrillDownService.js` +
`POST/GET /api/accounting-v2/reports/drill-down`.

## Chain

Report line → mapped accounts (codes and names) → General Ledger account
activity (`getAccountLedger`: opening, period, closing, running balances) →
journal entry lines (with journal kind, reversal flags, architecture version,
source type/id, dimensions, currency) → journal entries → source transactions.
Attachments/approvals/audit history resolve from the journal ids through the
existing journal screens.

## Scope preservation

Drill-down derives its window from the envelope (`dateRange` / `asOfDate`) —
business, dates and branch travel with the report; a context whose business
differs from the envelope's is rejected before any query (tested).

## Basis correctness

The envelope's `drillDownBasis` decides what must sum to the line:

- `PERIOD` (Income Statement, Cash Flow, Equity statement): the account's
  signed period movement.
- `AS_OF` (Balance Sheet, aging control lines, module reports): the account's
  cumulative signed closing balance.

The line's `displaySign` is unapplied before comparison, so presentation signs
cannot cause false mismatches.

## Sum-to-source guarantee (REP-025)

The sum of per-account ledger values must equal the report line amount. A
mismatch returns `reconciles: false` with a REP-025 finding carrying the exact
signed difference — never a silently adjusted number. The reconciliation
service drills a sample of statement lines on every run.

Tested: period-basis lines (revenue, operating expenses, finance costs),
as-of lines (cash, AR, owner capital, loans), journal-line presence, and
cross-business rejection.
