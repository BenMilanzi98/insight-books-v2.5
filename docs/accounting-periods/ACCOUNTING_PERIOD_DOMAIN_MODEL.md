# Accounting Period Domain Model

Model: `AcctV2AccountingPeriod` (`prisma/schema.prisma`).

## Fields

`id`, `tenantId`, `financialYearId`, `periodNumber` (1–12, unique per year),
`name` ("July 2026"), `code` (`FY2026-P07`, unique per business), `startDate`,
`endDate` (inclusive, date-only UTC), `status`, `sequence`, `lockDate`,
`closedAt` / `reopenedAt`, `isAdjustmentPeriod`, `isYearEndPeriod`,
`legacyPeriodId` (migration alias), `architectureVersion`, `createdBy` /
`closedBy` / `reopenedBy`, `closeReason` / `reopenReason`,
`currentCloseRunId`, `metadata`.

## Statuses

`DRAFT → OPEN → CLOSING → (OPEN | CLOSED)`; `CLOSED → REOPENED → CLOSING → CLOSED`
(`AccountingPeriodStatus` + `PERIOD_TRANSITIONS` in `periodEnums.js`).
SOFT_CLOSED is intentionally not used — lock dates provide rolling protection
below period status.

## Enforced rules

| Rule | Enforcement |
| --- | --- |
| Belongs to one year and the same business | FK + creation inside `createFinancialYear`; cross-checks in integrity audit |
| No overlaps / gaps | `validatePeriodCoverage` at creation (transactional rollback) + PER-102/103 |
| Unique number/code | DB unique constraints `(financialYearId, periodNumber)` and `(tenantId, code)` + PER-105/106 |
| Deterministic sequence | `generateMonthlyPeriods` assigns `periodNumber = sequence` in date order |
| No ordinary deletion with journals | no delete API exists; migration never deletes |
| Closing preserves history | closure only sets status/metadata and writes history; journal rows untouched |
| Reopening preserves the close record | close runs become `SUPERSEDED`, never deleted |

Lifecycle writes go exclusively through
`lib/accountingV2/periods/periodLifecycleService.js` (`transitionPeriod`,
`setPeriodLockDate`) which append `AcctV2PeriodStatusHistory` rows.
