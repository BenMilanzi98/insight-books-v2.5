# Accounting Domain Model (implemented)

All types live in `lib/accountingV2/domain/` as frozen-object factories with JSDoc typing and
runtime validation (the project's JavaScript convention).

## AccountingContext (`accountingContext.js`)
`businessId, branchId, departmentId, projectId, costCentreId, financialYearId,
accountingPeriodId, currency, baseCurrency, userId, permissions, requestId, correlationId,
sourceChannel`. Built via `contextFromSessionUser(sessionUser)` — the tenant always comes from
the session; a client-supplied mismatch throws `CrossTenantAccountingError`. Every command
requires one; services never infer business from global state.

## SourceReference (`sourceReference.js`)
`sourceModule, sourceType, sourceId, sourceNumber, eventType, eventVersion,
externalReference, importBatchId, webhookEventId, description, metadata`. Enum-validated.
`deriveIdempotencyKey(businessId, ref)` produces
`ACCOUNTING:{businessId}:{module}:{type}:{id}:{eventType}:{version}` — identity only, never
timestamps or amounts. `hashCommandContent` fingerprints material fields to detect key reuse
with different data.

## MoneyValue (`money.js`)
`{ minor, currency, scale, decimal }` — integer minor units are authoritative (delegating to the
proven `lib/money.js` cent arithmetic); decimal strings at API boundaries; scale 2; half-up
rounding; cross-currency arithmetic refused; `convertToBase` requires a positive rate and
validates safe magnitude. JS floats are accepted only for legacy-adapter interop.

## JournalDraft / JournalLineDraft (`journalDraft.js`)
Draft = validated pre-persistence journal: `description, transactionDate, postingDate,
sourceReference, currency, exchangeRate, financialYearId, accountingPeriodId, dimensions,
lines[], metadata, totals`. Structural rules enforced at construction:
- ≥ 2 lines; debits = credits in transaction currency AND base currency (minor-unit equality)
- a line is debit XOR credit; no negatives; zero-value lines need an explicit approved reason
Contextual rules (tenancy, active/posting accounts, period) belong to the validation service
with repository access — pre-checked today by `assertAccountsBelongToBusiness` +
`resolveLegacyPeriod`; completed in Phase 4.

## Dimensions (`dimensionPolicy.js`)
14 standard dimensions (branch → tax code). Per-event policies declare required / prohibited /
require-one-of groups (e.g. INVOICE_POSTED requires customer, prohibits supplier;
CAPITAL_CONTRIBUTION_POSTED requires owner|shareholder). Unspecified events use a permissive
default until Phase 4 completes the catalogue. Dimensions never bypass tenant validation —
they ride inside business-scoped commands.

## Enumerations (`enums.js`)
Single frozen definitions: `AccountingSourceModule` (20), `AccountingEventType` (32),
`JournalStatus` (9), `ApprovalStatus` (5), `PostingMode` (5), `AccountNormalBalance`,
`AccountCategory` (8), `AccountBehaviour` (5), `ReversalStatus` (4), `PeriodStatus` (3),
`AuditSeverity` (5), plus infrastructure enums (`EventRegistryStatus`, `ArchitectureVersion`,
`ShadowComparisonStatus` (11), `OutboxStatus`, `AttemptStatus`). A boundary test asserts
`PostingMode` is defined exactly once in the codebase.

## Errors (`errors.js`)
`AccountingV2Error` base with `code, userMessage, httpStatus, retryable, diagnostic,
requestId, correlationId` and `toSafeJSON()` (no diagnostics/stack to clients). 18 typed
subclasses matching the specification (configuration, mapping, period, balance, duplicate,
idempotency conflict, cross-tenant, inactive/non-posting account, currency, exchange rate,
approval, immutability, reversal, source-not-found, concurrency, legacy, validation, disabled).
`classifyError` marks only transient DB codes (P2034/P1017/P2024/40001/40P01) retryable.
