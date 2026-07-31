# Error and Retry Architecture

Implementation: `lib/accountingV2/domain/errors.js` (typed hierarchy) and
`lib/accountingV2/engine/retryPolicy.js` (classification + backoff).

## Typed errors

All engine errors extend `AccountingV2Error` and carry: safe `code`, safe
`userMessage`, internal `diagnostic` details, `retryable` flag, `httpStatus`,
`requestId`, `correlationId`, and business/event context. The API layer
(`api/routeGuard.js` → `accountingErrorResponse`) maps them to client-safe
JSON; database stack traces are never exposed.

Catalogue (all implemented): `InvalidPostingCommandError`,
`AccountingContextRequiredError`, `SourceNotFoundError`,
`SourceNotPostableError`, `SourceAlreadyPostedError`,
`DuplicateAccountingEventError`, `ConflictingIdempotencyKeyError`,
`PostingInProgressError`, `ApprovalRequiredError`, `ApprovalInvalidError`,
`MissingAccountMappingError`, `ConflictingAccountMappingError`,
`AccountNotFoundError`, `CrossTenantAccountError`, `InactiveAccountError`,
`DeprecatedAccountError`, `NonPostingAccountError`,
`ControlAccountDimensionError`, `InvalidAccountingPeriodError`,
`ClosedAccountingPeriodError`, `InvalidPostingDateError`,
`InvalidCurrencyError`, `InvalidExchangeRateError`, `UnbalancedJournalError`,
`InvalidJournalLineError`, `JournalPersistenceError`,
`SourceStateUpdateError`, `AccountingConcurrencyError`,
`PostingTemplateNotFoundError`, `PostingTemplateValidationError`,
`LegacyAndNewPostingConflictError`, `ShadowPostingPersistenceError`,
`JournalImmutableError`.

## Retry policy

`classifyPostingFailure(error)` labels every failure:

- **Retryable**: deadlocks, connection failures, lock timeouts, transient
  Prisma errors (`P1001`, `P1002`, `P2034`, …), `PostingInProgressError`,
  outbox delivery failures.
- **Non-retryable**: all business rule violations — missing/conflicting
  mappings, closed periods, invalid sources, unbalanced journals,
  cross-business accounts, invalid approvals, conflicting idempotency keys,
  invalid currency, deprecated accounts.

`canRetry(classification, attemptCount)` caps attempts (max 5) with
exponential backoff. Retries reuse the same idempotency key, event identity
and command hash; every attempt is recorded as an `AcctV2PostingAttempt`;
`retryPosting` refuses non-retryable failures and unknown events, and treats
retry-after-success as an idempotent replay. There is no unbounded automatic
retry loop.
