# Phase 7 — Trial Balance and Financial Reporting Engine

This folder documents the Phase 7 reimplementation of the complete financial
reporting backend. Every formal report derives from canonical posted Journal
Entry Lines through the Phase 5 General Ledger Query Service; no report reads
operational tables or stored account balances as authoritative financial
values.

## Data path

```
Canonical Posted Journal Entry Lines   (lib/accountingV2/ledger/canonicalJournalSource.js)
        ↓
General Ledger Query Service           (lib/accountingV2/ledger/ledgerQueryService.js)
        ↓
Trial Balance Engine                   (lib/accountingV2/reporting/trialBalanceService.js)
        ↓
Financial Statement Mapping Engine     (lib/accountingV2/reporting/reportDefinitions.js)
        ↓
Financial Reports                      (financialStatementService.js, subledgerReportsService.js)
        ↓
Drill-Down and Source Traceability     (reportDrillDownService.js)
        ↓
CSV, Excel and PDF Exports             (reportExportService.js)
```

## Code map

| Concern | Location |
| --- | --- |
| Request/result contracts | `lib/accountingV2/reporting/reportContracts.js` |
| Report definitions and mapping | `lib/accountingV2/reporting/reportDefinitions.js` |
| Trial Balance | `lib/accountingV2/reporting/trialBalanceService.js` |
| IS / BS / CF / Equity statement | `lib/accountingV2/reporting/financialStatementService.js` |
| AR/AP aging, module reports, BvA | `lib/accountingV2/reporting/subledgerReportsService.js` |
| Drill-down | `lib/accountingV2/reporting/reportDrillDownService.js` |
| Validation (REP-001..040) + reconciliation | `lib/accountingV2/reporting/reportValidationService.js` |
| Runs, review/approval, snapshots | `lib/accountingV2/reporting/reportRunService.js` |
| Cache | `lib/accountingV2/reporting/reportCacheService.js` |
| Facade (single entry point) | `lib/accountingV2/reporting/financialReportService.js` |
| Exports (CSV/Excel/PDF) | `lib/accountingV2/reporting/reportExportService.js` |
| Dashboard KPIs | `lib/accountingV2/reporting/dashboardKpiService.js` |
| Report permissions | `lib/accountingV2/reporting/reportPermissions.js` |
| API routes | `app/api/accounting-v2/reports/**` |
| UI | `app/reports-v2/page.js` |
| Schema | `AcctV2ReportRun`, `AcctV2ReportSnapshotV2`, `AcctV2ReportCache` (`prisma/schema.prisma`) |
| Migration | `prisma/migrations/20260720220000_acctv2_reporting/migration.sql` |
| Tests | `test/accountingV2.reports.test.js` (57 tests) |

## Reading order

Start with `FINAL_PHASE_7_REPORT.md` for the executive summary, then
`TARGET_REPORTING_ARCHITECTURE.md` and `FINANCIAL_REPORTING_ENGINE.md` for the
design, then the per-report implementation documents.
