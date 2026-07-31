# Automatic Period Generation

Pure functions in `lib/accountingV2/periods/periodGeneration.js`; orchestrated
by `financialYearService.createFinancialYear`.

## Algorithm

1. `computeFinancialYearRange({startYear, startMonth, startDay})` computes the
   inclusive year range. End date = day before the same anchor next year;
   Feb-29 anchors are clamped safely in non-leap years.
2. `generateMonthlyPeriods({fyCode, startDate, endDate})` walks calendar
   months: each period runs from the current cursor to the earlier of
   month-end or year-end. 28/29/30/31-day months come from `daysInMonth`
   (leap-year aware). Mid-month year starts produce correct partial first and
   last months while preserving 12 periods for day-1 starts.
3. Names are human-readable ("July 2026"); codes are deterministic
   (`FY2026-P01` … `FY2026-P12`); `periodNumber` counts in date order.
4. `validatePeriodCoverage(range, periods)` re-verifies the generated set:
   first period starts on year start, last ends on year end, each period
   starts exactly one day after the previous end (no gaps, no overlaps).

## Atomicity

`createFinancialYear` creates the year and all periods in a single Prisma
transaction and calls `validatePeriodCoverage` inside it — a failed validation
rolls back everything (test: "atomic creation rollback"). A year is never
persisted without its complete period set.

## Tested cases

January–December, July–June, leap year (FY2028 Feb 29), 28/30/31-day months,
gap/overlap detection, deterministic names/numbers, rollback on tampered
generation. See `test/accountingV2.periods.test.js` ("period generation").
