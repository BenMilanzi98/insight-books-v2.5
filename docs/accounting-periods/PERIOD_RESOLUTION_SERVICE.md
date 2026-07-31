# Period Resolution Service

`lib/accountingV2/periods/periodResolutionService.js` — the canonical V2
resolver completing the Phase 2 contract and superseding the Phase 4 interim
resolver (behind `PERIOD_FLAGS.RESOLVER_V2`).

## Contract

```js
resolvePeriodV2(db, context, {
  transactionDate, requestedPostingDate, sourceModule, sourceType,
  eventType, postingMode, permissions, now,
})
```

Returns `financialYearId`, `accountingPeriodId`, `financialYearCode`,
`periodCode`, `transactionDate`, `resolvedPostingDate`, `periodStatus`,
`financialYearStatus`, `isBackdated`, `isFutureDated`, `requiresApproval`,
`warnings`, `resolutionRule`, `requestId`, `correlationId`.

## Deny-by-default rejections (typed errors, all audited)

| Condition | Error |
| --- | --- |
| No financial year covers the date | `InvalidAccountingPeriodError` (`NO_FINANCIAL_YEAR`) |
| No period covers the date (gap) | `InvalidAccountingPeriodError` (`NO_COVERING_PERIOD`) |
| More than one period covers the date | `InvalidAccountingPeriodError` (`PERIOD_OVERLAP`) |
| Period CLOSED | `ClosedAccountingPeriodError` with period name/dates/year + reopening guidance |
| Period CLOSING without authorization | `InvalidAccountingPeriodError` |
| Period REOPENED without adjustment authorization | `InvalidAccountingPeriodError` |
| Year CLOSED/ARCHIVED | `InvalidAccountingPeriodError` |
| Backdated (prior period) without permission/reason | `InvalidPostingDateError` |
| Future-dated beyond tolerance/policy | `InvalidPostingDateError` |
| On/before lock date | `InvalidPostingDateError` |
| Wrong business | impossible — every query is `tenantId`-scoped |

**No silent fallback:** a historical date with no matching period fails; it is
never redirected to the current period.

Backdating semantics: a posting is *backdated* when its resolved period ends
before the period containing "today" — earlier dates inside the current open
period are ordinary postings (§20 prior-period rule).

`validatePostingDate(...)` wraps the resolver in a non-throwing dry-run
(`{allowed, reason, resolution}`) used by operational guards, imports,
webhooks and the `/periods/resolve` API.
