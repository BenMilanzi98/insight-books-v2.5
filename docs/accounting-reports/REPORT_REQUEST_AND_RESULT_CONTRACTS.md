# Report Request and Result Contracts

Implemented in `lib/accountingV2/reporting/reportContracts.js`.

## Request

`normalizeReportRequest(context, reportType, raw)` produces a frozen request:

- `businessId` — ALWAYS from the accounting context (session); client-supplied
  business ids are ignored.
- `fromDate`, `toDate`, `asOfDate` — validated dates; `fromDate > toDate`
  rejected. `asOfDate` defaults to `toDate`.
- `financialYearStartDate` — explicit or defaulted to 1 January of the as-of
  year; drives the Current Year Earnings / Retained Earnings split.
- `comparison` — `{fromDate, toDate, asOfDate}`; a period report with an
  incomplete comparative period is rejected (REP-035 at the boundary).
- `branchId`, `departmentId`, `projectId`, `costCentreId`, `currency`,
  `presentationCurrency`.
- `includeZeroBalances`, `includeDeprecatedAccounts` (default true — deprecated
  historical accounts remain reportable), `includeAccountDetails`,
  `includeComparatives`, `includeBudget`.
- `includeUnposted` — **rejected if truthy**; formal reports never include
  unposted journals.
- `reportBasis` (default ACCRUAL), `reportDefinitionId`,
  `reportDefinitionVersion`, `outputFormat`, `requestId`, `correlationId`.

Clients can never submit report SQL or arbitrary account queries; only these
whitelisted fields exist.

`hashReportRequest(request)` returns a deterministic SHA-256 over the
scope-relevant fields — used as the cache key, run filter hash and audit
fingerprint.

## Result envelope

`buildReportEnvelope` produces the standard result: `reportId`, `reportType`,
`reportName`, `businessId`, `financialYear`, `dateRange`, `asOfDate`,
`comparisonScope`, `currency`, `generatedAt/By`, `definitionId/Version`,
`architectureVersion`, `reportStatus`, `integrityStatus`, `integrityWarnings`,
`unresolvedExceptions` (open Phase 6 anomalies), `lines`, `totals`,
`drillDownBasis` (`PERIOD` | `AS_OF`), `filtersHash`, `resultChecksum`
(SHA-256 over lines + totals — snapshot guard), `requestId`, `correlationId`
and a `sourcePolicy` block asserting canonical-only sourcing.

## Report lines

`buildReportLine` enforces the controlled line-type list (TITLE, SECTION,
SUBSECTION, ACCOUNT, ACCOUNT_GROUP, CALCULATED_TOTAL, SUBTOTAL, GRAND_TOTAL,
RATIO, MEMO, DISCLOSURE, VARIANCE, WARNING) and emits: `lineId`, `code`,
`label`, `hierarchyLevel`, `parentLineId`, `displayOrder`, `currentAmount`,
`comparativeAmount`, `varianceAmount`, `variancePercentage`, `budgetAmount`,
`budgetVariance`, `accountIds`, `accountCodes`, `accountNames`, `accounts`
(per-account amounts for expansion), `mappingRule`, `normalBalance`,
`displaySign`, `drillDownAvailable`, `warningStatus`, `metadata`.

All amounts are `{minor, decimal}` — integer minor units with a derived
decimal string. JavaScript floats are never authoritative.
