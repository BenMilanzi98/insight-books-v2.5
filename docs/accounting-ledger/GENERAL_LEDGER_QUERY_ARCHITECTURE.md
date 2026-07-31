# General Ledger Query Architecture

`lib/accountingV2/ledger/ledgerQueryService.js` is the single ledger
computation engine. Screen, export and API all call this service — never their
own queries — so every surface shows identical numbers. It sources exclusively
from the canonical journal source and never reads stored balance caches.

## Balance definitions

For a window `[startDate, endDate]` and an account:

| Figure | Definition |
| --- | --- |
| Opening balance | Net posted activity (debits − credits, integer minor units) strictly before `startDate`, over the account's merge-rollup group |
| Period movement | Raw period debits and raw period credits, reported separately (never pre-netted) |
| Closing balance | Opening + period debits − period credits |
| Running balance | Opening balance carried line by line in canonical chronological order |

Deterministic line order for running balances: posting date, posted-at,
journal number, entry id, line number, line id. Descending display reverses
the computed ascending rows without recomputing (fixes legacy defect P5-I04
where each page recomputed running balances from a per-page opening).

Pagination carries the page-opening balance: page N's first running balance
equals the closing running balance of page N−1, because the full window is
computed in canonical order before slicing.

## Normal-balance presentation

`resolveNormalBalance` decides presentation polarity by configuration, never
by account-code ranges:

1. `coaV2NormalBalance` (CoA V2 configuration)
2. legacy `normalBalance` column
3. CoA V2 category default (ASSET/EXPENSE → DEBIT, LIABILITY/EQUITY/REVENUE → CREDIT)
4. legacy `accountType`/`type` default
5. fallback DEBIT **with an explicit configuration warning**

`presentBalance` returns both the signed (debit-positive) figure and the
display figure under the account's normal balance, with `abnormal: true` when
the account sits on the wrong side (e.g. a credit-balance asset). Abnormal
balances are flagged, never hidden or clamped.

## Account hierarchy

- Posting (leaf) accounts hold the authoritative balances.
- Parent/header rows aggregate children **for presentation only** and are
  marked `presentationOnly: true` in the hierarchy view; they are never stored
  and never posted to.
- Direct posted activity on a header/non-posting account is reported as a
  GL-110 anomaly, not silently merged into children.
- Merged-away accounts roll up to their survivor (`accountMergeRollup`); the
  activity view preserves the original posting account on each line and flags
  `rolledUpFromMergedAccount`.

## Dimensions

- `branchId` is a native header dimension on both ledgers.
- V2 lines carry a `dimensions` JSON object; account activity supports
  `dimensionKey`/`dimensionValue` filters.
- Legacy lines without dimension data are reported under `UNASSIGNED` —
  dimensions are never fabricated for historical rows.

## Multi-currency

- The ledger is maintained in base currency (`baseDebit`/`baseCredit` on V2
  lines; legacy lines are base-currency by definition).
- Original transaction currency and amounts remain visible in line detail; a
  `currency` filter narrows activity views.
- Historical journals are never converted retroactively; rates live on the
  journal (`exchangeRate`) from posting time.

## Reversals in the ledger

Original and reversal both appear as posted lines and net to zero after the
reversal date. The journal browser can present pairs linked (via
`originalJournalId`/`reversedByJournalId`); collapsing pairs is a
presentation-level option that never removes lines from balance math.

## Consumers

| Surface | Path |
| --- | --- |
| Business summary API | `GET /api/accounting-v2/ledger` |
| Account activity API | `GET /api/accounting-v2/ledger/account/[id]` |
| Canonical journal browser | `GET /api/accounting-v2/ledger/journals` |
| CSV export | `GET /api/accounting-v2/ledger/export` (same query contract as the screen) |
| GL V2 UI | `app/general-ledger-v2/page.js` |
