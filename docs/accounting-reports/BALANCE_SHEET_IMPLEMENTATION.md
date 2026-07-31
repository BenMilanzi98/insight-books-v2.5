# Balance Sheet (Statement of Financial Position) Implementation

`generateBalanceSheet` in `financialStatementService.js`, definition
`BS-STANDARD` 1.0.0.

## Structure

ASSETS (Cash and Cash Equivalents, Accounts Receivable, Inventory,
Prepayments, PP&E, Less Accumulated Depreciation, Other Assets) → TOTAL
ASSETS; LIABILITIES (Accounts Payable, Taxes Payable, Payroll Liabilities,
Loans and Borrowings, Other Liabilities) → TOTAL LIABILITIES; EQUITY (Owner
Capital and Contributions, Less Owner Drawings, Other Equity and Reserves,
Retained Earnings (posted), Retained Earnings (calculated prior years),
Current Year Earnings) → TOTAL EQUITY → TOTAL LIABILITIES AND EQUITY.

## Calculation rules

- **Cumulative closing balances as of the selected date** — never period
  activity only. Two GL windows are queried: all activity to the as-of date,
  and the financial-year window for the CYE split.
- Revenue/expense accounts are excluded from position lines by scope
  (`!profile.isPnl`); they surface only through the calculated earnings lines.
- **Current Year Earnings** = −(FY-window P&L movement) — method A (§27): a
  calculated reporting line derived from Income Statement accounts, never
  typed, never a stored balance, never counted twice (single line; tested).
- **Retained Earnings (calculated)** = −(all-time P&L − FY P&L) — accumulated
  prior-year results. Posted retained-earnings accounts appear separately as
  "Retained Earnings (posted)", so approved year-end closing entries (Phase
  12) are reported without duplication; missing closing entries simply appear
  as calculated rather than posted amounts.
- Contra assets (accumulated depreciation) present under assets with their
  credit-normal sign reducing the total.

## Validation (REP-003 and control agreements)

`Assets − Liabilities − Equity` must equal zero. When it does not: the exact
difference is disclosed in `totals.equationDifference`, contributing
unmapped/unclassified accounts are listed, VERIFIED is blocked, and **no
balancing figure is inserted** (tested with an unclassified account: the
report goes UNVERIFIED with REP-036/REP-003 and `balanced: false`).
Cash/AR/AP/inventory/asset/loan/equity agreement with control accounts is
checked by `runReportReconciliation` (REP-004..REP-012 families).

Fixture assertions: total assets 1,287,000 = liabilities 275,000 + equity
1,012,000; owner capital exactly 1,000,000 (mirror journal excluded); CYE
20,000 equals Income Statement net profit; as-of comparatives supported.
