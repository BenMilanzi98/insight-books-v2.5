# Posting Command Contract

Implementation: `lib/accountingV2/engine/postingCommand.js` (`createPostingCommand`).

A Posting Command is the only input the engine accepts. It is validated fully
before any database mutation; invalid commands throw
`InvalidPostingCommandError` with per-field issues.

## Fields

| Group | Fields |
| --- | --- |
| Context | `context` (AccountingContext: businessId/tenantId, userId, requestId, correlationId), `branchId`, `departmentId`, `projectId`, `costCentreId` |
| Actors | `initiatedBy` (defaults to context user), `approvedBy`, `approvalReference` |
| Source identity | `sourceReference` { `sourceModule`, `sourceType`, `sourceId`, `sourceNumber?` }, `eventType`, `eventVersion` (default 1) |
| Idempotency | `idempotencyKey` — derived canonically when not supplied (see below) |
| Dates | `transactionDate` (required, ISO `YYYY-MM-DD`), `requestedPostingDate?` |
| Money | `currency` (ISO code, defaults to business base), `exchangeRate?`, `baseCurrency?`, `totalAmount?`, `taxAmount?` — all monetary values must be decimal strings; floats are rejected |
| Description | `description`, `externalReference`, `attachmentReferences[]` |
| Correlation | `importBatchId?`, `webhookEventId?` |
| Dimensions | `dimensions` object validated against `domain/dimensionPolicy.js` |
| Metadata | `metadata` (JSON-safe, size-limited, no prototype pollution keys) |

## Canonical idempotency key

```
ACCOUNTING:{businessId}:{sourceModule}:{sourceType}:{sourceId}:{eventType}:{eventVersion}
```

Same source + different event type, or a new event version, produce distinct
identities (legitimate multiple events per source are preserved).

## Server-resolved fields — client overrides rejected

The following are never accepted from callers and are resolved by the engine:

- `postingMode` (feature flags), `architectureVersion`
- accounting period / financial year (period resolver)
- journal number (sequence allocator)
- approval *status* (validated against stored approvals, not trusted input)

## Rejection rules

The builder rejects: missing business context; missing source identity or
event type; unknown event type; invalid/ambiguous dates; invalid currency
codes; non-decimal-string or NaN/Infinity amounts; negative amounts where
prohibited; invalid dimensions; unsupported metadata; client-supplied
architecture or mode overrides.

## Command hash

`computeCommandHash(command, draft)` produces a SHA-256 over the normalized
material fields (source identity, dates, currency, amounts, line content).
The hash is stored on the event registry row and compared on replay: a request
reusing an existing idempotency key with a **different** hash is rejected with
`ConflictingIdempotencyKeyError`; an identical hash replays the original
result.
