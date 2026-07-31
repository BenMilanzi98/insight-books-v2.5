# Financial Year Domain Model

Model: `AcctV2FinancialYear` (`prisma/schema.prisma`).

## Fields

`id`, `tenantId` (business), `name` ("FY2026 (Jan – Dec 2026)"), `code`
(`FY2026`, unique per business), `startDate`, `endDate` (inclusive, date-only
UTC), `numberOfPeriods` (12), `periodFrequency` (`MONTHLY`), `status`,
`isCurrent`, `previousFinancialYearId`, `architectureVersion` (`v2`),
`createdBy` / `openedBy` / `closedBy`, `createdAt` / `openedAt` / `closedAt`,
`metadata`.

## Statuses

`DRAFT → OPEN → CLOSING → CLOSED → REOPENED → …` plus `ARCHIVED`
(`FinancialYearStatus` in `periodEnums.js`).

## Enforced rules

| Rule | Enforcement |
| --- | --- |
| One business per year | `tenantId` on every row + all queries business-scoped |
| start < end | `previewFinancialYear` validation |
| No overlapping years | `createFinancialYear` overlap query + PER-101 audit |
| Complete periods | periods created in the same transaction; `validatePeriodCoverage` rolls back on gap/overlap |
| One current year | `openFinancialYear` clears other `isCurrent` flags; PER-109 audits drift |
| Closed years reject postings | `resolvePeriodV2` checks year status |
| Delete with journals prohibited | `assertFinancialYearDeletable` counts journals carrying the year's periods |
| Creation/opening audited | `recordAccountingAudit` + `AcctV2PeriodStatusHistory` per period |

Service: `lib/accountingV2/periods/financialYearService.js`
(`previewFinancialYear`, `createFinancialYear`, `openFinancialYear`,
`listFinancialYears`, `getFinancialYear`, `assertFinancialYearDeletable`).
