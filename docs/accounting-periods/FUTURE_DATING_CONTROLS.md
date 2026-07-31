# Future-Dating Controls

## Policy options (`futureDatingPolicy` in calendar config)

| Policy | Behaviour |
| --- | --- |
| `REJECT` | any posting date after today is rejected |
| `TOLERANCE_WITH_WARNING` (default) | dates within `futureToleranceDays` (default 7) post with a `FUTURE_DATED_WITHIN_TOLERANCE` warning; beyond tolerance rejected |
| `ALLOW_WITH_PERMISSION` | requires `accountingPeriods.postFutureDated` |

## Enforcement

- `evaluatePostingDate` computes `isFutureDated` and either a violation
  (rejection) or a warning (tolerated).
- `resolvePeriodV2` throws `InvalidPostingDateError` for violations and
  returns `isFutureDated: true` + warnings otherwise.
- A date beyond the last generated period also fails `NO_FINANCIAL_YEAR` /
  `NO_COVERING_PERIOD` — the calendar itself bounds how far ahead posting is
  possible.
- Future-dated *drafts* never enter the General Ledger: only POSTED journals
  exist in ledger queries (Phase 5 contract); scheduled transactions are not
  posted journals.
