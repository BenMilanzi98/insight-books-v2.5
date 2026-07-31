# Trial Balance UI

The Trial Balance is served by the Phase 7 reports page `app/reports-v2/page.js`
(Core Accounting category) through `GET /api/accounting-v2/reports/generate?type=TRIAL_BALANCE`.

## Displayed columns

Account code, account name, category, opening debit, opening credit, period
debit, period credit, closing debit, closing credit, warning badge, and a
per-account "view details" expansion (drill-down into GL activity and journal
lines via the drill-down API).

## Header area

Business, date range / as-of date, currency, Trial Balance status chip
(BALANCED green / BALANCED_WITH_WARNINGS amber / UNBALANCED red / BLOCKED
grey), integrity warnings summary, unresolved historical exceptions
disclosure, totals row with debit/credit totals and the exact difference when
unbalanced, generated-at and generated-by.

## Controls

Date range and as-of pickers, include-zero-balances toggle, comparative scope
selector, export buttons (CSV / Excel / PDF via
`/api/accounting-v2/reports/export`), and links to the accounting integrity
surface for disclosed findings.

Client-side code performs **no** totalling: every figure, including totals and
differences, comes from the server envelope (client totals are never
authoritative; pagination cannot alter totals).

The legacy `/reports` Trial Balance remains available behind the existing
routes until cutover; the `trialBalanceV2Enabled` flag governs rollout (see
CONTROLLED_ROLLOUT.md).
