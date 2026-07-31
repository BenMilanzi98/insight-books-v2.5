# Accounting Periods UI

The canonical V2 period list lives inside `/financial-calendar-v2` (period
cards + detail panel); the legacy `/accounting-periods` page continues to
manage legacy rows during the controlled rollout.

## Period list shows

Period number/name/code, start and end dates, financial year, status badge,
lock date, current-period marker; the detail panel adds Trial Balance /
report / integrity statuses from the active close run, close progress,
blocking tasks, exceptions, closed/reopened by and dates, status history and
close-run history.

## Filters

By financial year (year cards or dropdown) and implicitly by business (the
session business scopes every API call — no cross-business selector exists).

## Legacy page

`/accounting-periods` still operates on the legacy `AccountingPeriod` table
via the legacy close/reopen endpoints. Once a business is migrated and
`PERIODS_V2` is enabled, the V2 page is authoritative; the legacy page will
be retired in Phase 9 cleanup.
