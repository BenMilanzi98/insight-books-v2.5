# Period Overlap and Gap Validation

Two layers: creation-time validation (blocking) and the read-only Calendar
Integrity Service (detective).

## Creation-time (blocking)

- `createFinancialYear` rejects any new year whose range intersects an
  existing year for the business.
- `validatePeriodCoverage` runs inside the creation transaction: any gap,
  overlap, or boundary mismatch rolls the whole year back.
- DB constraints: unique `(tenantId, code)` on years and periods, unique
  `(financialYearId, periodNumber)`.

## Calendar Integrity Service (detective)

`lib/accountingV2/periods/calendarIntegrityService.js` →
`runCalendarIntegrityAudit(db, context)`; exposed via
`GET /api/accounting-v2/periods/integrity` and the UI's "Run integrity audit".

| Rule | Meaning |
| --- | --- |
| PER-101 | Financial years overlap |
| PER-102 | Accounting periods overlap |
| PER-103 | Gap between accounting periods |
| PER-104 | Period outside financial year |
| PER-105 | Duplicate period number |
| PER-106 | Duplicate period code |
| PER-107 | Missing month (fewer periods than configured) |
| PER-108 | Financial year lacks periods |
| PER-109 | Multiple current financial years |
| PER-110 | Current period does not belong to current year |

Findings are returned, never auto-repaired. The resolver independently
rejects ambiguous coverage (more than one period covering a posting date)
with `PERIOD_OVERLAP`, so a corrupted calendar fails closed rather than
posting into an arbitrary period.
