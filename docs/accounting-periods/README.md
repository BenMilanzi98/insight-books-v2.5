# Phase 8 — Financial Calendar, Accounting Periods and Period Control Framework

Business-scoped financial calendar for InsightBooks V2: canonical financial
years, automatically generated monthly periods, server-side period resolution,
controlled period close/reopen workflows, immutable status history and report
snapshots.

## Code map

| Area | Location |
| --- | --- |
| Enums and state machine | `lib/accountingV2/periods/periodEnums.js` |
| Period generation (pure) | `lib/accountingV2/periods/periodGeneration.js` |
| Date policy framework | `lib/accountingV2/periods/datePolicy.js` |
| Calendar configuration | `lib/accountingV2/periods/calendarConfigService.js` |
| Financial year lifecycle | `lib/accountingV2/periods/financialYearService.js` |
| Period lifecycle + lock dates | `lib/accountingV2/periods/periodLifecycleService.js` |
| Period Resolution Service | `lib/accountingV2/periods/periodResolutionService.js` |
| Calendar integrity (PER-101…110) | `lib/accountingV2/periods/calendarIntegrityService.js` |
| Close checklist templates | `lib/accountingV2/periods/periodCloseChecklist.js` |
| Close workflow | `lib/accountingV2/periods/periodCloseService.js` |
| Reopen / re-close workflow | `lib/accountingV2/periods/periodReopenService.js` |
| Monitoring | `lib/accountingV2/periods/periodMonitoringService.js` |
| Readiness assessment | `lib/accountingV2/periods/periodReadinessService.js` |
| Legacy migration | `lib/accountingV2/periods/legacyPeriodMigrationService.js` |
| APIs | `app/api/accounting-v2/periods/**` |
| UI | `app/financial-calendar-v2/page.js` |
| Prisma models | `prisma/schema.prisma` (`AcctV2FinancialCalendarConfig`, `AcctV2FinancialYear`, `AcctV2AccountingPeriod`, `AcctV2PeriodStatusHistory`, `AcctV2PeriodCloseRun`, `AcctV2PeriodCloseTask`, `AcctV2PeriodCloseException`, `AcctV2PeriodReopenRequest`) |
| Migration SQL | `prisma/migrations/20260721080000_acctv2_financial_calendar/migration.sql` |
| Tests | `test/accountingV2.periods.test.js` (44 tests) |

## Guarantees

- Posting date determines the period; transaction date is preserved separately.
- Period assignment is server-side; client period IDs are never trusted.
- Closed periods reject ordinary postings with a typed, audited error.
- Every status change writes an immutable `AcctV2PeriodStatusHistory` row.
- Close is checklist-driven, approved with separation of duties, and atomic.
- Reopening requires reason + second-person approval; original close runs and
  snapshots are superseded, never deleted.
- All controls are business-scoped and feature-flag gated (`PERIOD_FLAGS`).

See `FINAL_PHASE_8_REPORT.md` for the full phase report.
