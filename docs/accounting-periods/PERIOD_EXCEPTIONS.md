# Period Exceptions

Model: `AcctV2PeriodCloseException`; service functions `addCloseException`,
`acceptExceptionForClose`, `resolveCloseException`.

## Fields

business, financial year, period, close run, task key, `category`,
`severity`, `amountMinor` + currency, description, root cause, evidence,
status, acceptedBy/At, resolutionTarget, resolvedBy/At, metadata.

## Statuses

`OPEN → UNDER_REVIEW → (ACCEPTED_TEMPORARILY | ACCEPTED_FOR_CLOSE | RESOLVED | REJECTED)`.

## Materiality and always-blocking categories

`ALWAYS_BLOCKING_EXCEPTION_CATEGORIES` can never be accepted for close, at
any threshold:

- CROSS_TENANT_REFERENCE
- UNBALANCED_JOURNAL
- DUPLICATE_ACTIVE_POSTING
- MISSING_BUSINESS_OWNERSHIP
- CROSS_BUSINESS_REPORT_DATA
- JOURNAL_MISSING_ACCOUNT
- TB_SYSTEM_DEFECT
- UNSUPPORTED_MATERIAL_LIABILITY
- MISSING_HIGH_RISK_AUTHORIZATION

`acceptExceptionForClose` throws for these; other categories may be accepted
with reason + `accountingPeriods.manageExceptions` (and materiality override
permission where blocking). Accepted exceptions remain attached to the close
run and visible in period snapshots — acceptance never hides them.
