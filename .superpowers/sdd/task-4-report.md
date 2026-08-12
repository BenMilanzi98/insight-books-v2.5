# Task 4 Report — Open / reopen with optional funding

## Status
Implemented Task 4 for POS till opening:

- `openPosCashDay` now defaults omitted `openingBalance` to `0` instead of mirroring live cash.
- Reopening a same-day `CLOSED` row now reuses that row, clears close markers, increments `openCount`, and stamps `reopenedAt`.
- Opening balances above zero now fund the till through split cash/capital journal lines and persist `openFundingJournalId`, `fundingCashAmount`, `fundingCapitalAmount`, and `tillFloatAccountId`.
- Funding validation now throws coded conflicts for `CAPITAL_UNMAPPED`, `TILL_FLOAT_UNMAPPED`, and `CASH_COA_UNMAPPED`.
- The open route now maps those funding conflicts to HTTP `409`, and the till-open gate message no longer requires entering an opening balance.

## Verification

- `npx vitest run test/posTillFunding.test.js test/posTillFloatAccounts.test.js test/posCashDayOpenClose.test.js` — passed (26 tests).
- IDE diagnostics for `lib/posCashDayService.js`, `lib/posTillFunding.js`, `app/api/pos/cash-day/open/route.js`, `test/posCashDayOpenClose.test.js`, and `test/posTillFunding.test.js` — no lint errors.
- Red phase was verified first with the new tests failing against the old open/reopen behavior before implementing the fix.

## Smoke notes and concerns

- No live API/database smoke run was performed in this task; verification is focused on mocked Vitest coverage around service contracts and helper behavior.
- `finalizePosCashDayClose` and close sweep behavior were intentionally left untouched for Task 5.
- The working tree was already dirty in many unrelated files before this task; only the Task 4 POS till files above were changed here.

## Commits

None.
