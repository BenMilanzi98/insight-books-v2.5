# Financial Reporting Engine

`lib/accountingV2/reporting/financialReportService.js` is the centralized
engine facade. All fourteen report types route through one generator registry:

| Report type | Generator |
| --- | --- |
| TRIAL_BALANCE | `trialBalanceService.generateTrialBalance` |
| INCOME_STATEMENT | `financialStatementService.generateIncomeStatement` |
| BALANCE_SHEET | `financialStatementService.generateBalanceSheet` |
| CASH_FLOW | `financialStatementService.generateCashFlow` (indirect) |
| EQUITY_STATEMENT | `financialStatementService.generateEquityStatement` |
| RECEIVABLES / PAYABLES | `subledgerReportsService` aging generators |
| INVENTORY / FIXED_ASSETS / PAYROLL / LOANS / TAXES / EQUITY | `generateModuleReport` |
| BUDGET_VS_ACTUAL | `generateBudgetVsActual` |

`generateReport(db, context, reportType, rawParams, options)`:

1. Normalizes and validates the request (`normalizeReportRequest`) — the
   business always comes from the context; `includeUnposted` is rejected.
2. Optionally serves through the rebuildable cache (`options.useCache`),
   validated against the accounting data version.
3. Runs envelope-level structural validation (`validateEnvelope`) on every
   generation; critical findings force UNVERIFIED.
4. Records an auditable run row (`AcctV2ReportRun`) with filters hash, result
   checksum, integrity status and accounting data version.
5. Emits a structured log (`report.generate`) with duration, definition
   version, integrity status, request/correlation ids and cache hit.

Shared across all generators (no per-screen calculation logic):

- business scope and date/period resolution from the normalized request;
- the GL query source (`getBusinessLedgerSummary` / `getAccountLedger`);
- account mapping via `resolveAccountProfile` + declarative match rules;
- normal-balance presentation from the ledger service;
- reversal treatment and legacy/V2 authority from the canonical source;
- integer minor-unit arithmetic and the standard envelope/line contracts;
- drill-down, export and integrity validation services.

Conceptual components from the specification map as follows:
FinancialReportService → `financialReportService.js`; TrialBalanceService →
`trialBalanceService.js`; ReportDefinitionService / ReportMappingService /
ReportAggregationService → `reportDefinitions.js`; ReportCalculationService →
generators + `evaluateFormula`; ReportValidationService /
ReportIntegrityService → `reportValidationService.js`; ReportDrillDownService
→ `reportDrillDownService.js`; ReportComparisonService → comparative scopes in
contracts/generators; ReportSnapshotService / ReportAuditService →
`reportRunService.js`; ReportExportService → `reportExportService.js`;
ReportCacheService → `reportCacheService.js`.
