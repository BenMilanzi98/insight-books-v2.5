# Accounting Event Registry (Phase 4 completion)

Model: `AcctV2EventRegistry` (Phase 2 origin, extended in Phase 4).
Status machine: `lib/accountingV2/domain/eventStatus.js`.
Repository: `lib/accountingV2/infrastructure/eventRegistryRepository.js`.

## Record contents

Stable event identity (`id`), source identity (`sourceModule`, `sourceType`,
`sourceId`, `sourceNumber`), business (`tenantId`), `eventType`,
`eventVersion`, `idempotencyKey` (unique), `commandHash`, `postingMode`,
`architectureVersion`, `status`, journal linkage (`journalEntryId`,
`shadowJournalId`), failure details (`failureCode`, `failureMessage`,
`failureRetryable`), approval linkage (`approvalReference`, `approvedBy`),
template linkage (`templateId`, `templateVersion`), `attemptCount`,
`requestId`, `correlationId`, `createdAt`, `processingAt`, `postedAt`,
`metadata`.

Each attempt additionally writes an `AcctV2PostingAttempt` row (attempt
number, status, failure code, retryable flag, duration, request/correlation
IDs).

## Statuses and transitions

Implemented statuses (`EventRegistryStatus`): `RECEIVED`, `IN_PROGRESS`,
`POSTED`, `SHADOWED`, `FAILED`, `REJECTED`, `SUPERSEDED`, `REVERSED`.

Permitted transitions are declared in `EVENT_STATUS_TRANSITIONS` and enforced
by `assertEventStatusTransition(from, to)` — every registry status write goes
through this assertion, so a status can never skip required controls (e.g.
`RECEIVED → POSTED` is only allowed for the single-transaction claim+post
path; `FAILED → IN_PROGRESS` only for retryable failures; `POSTED` may only
move to `REVERSED` via a new reversal event).

Mapping to the prompt's recommended vocabulary:

| Prompt status | Implemented as |
| --- | --- |
| RECEIVED / VALIDATING / VALIDATED | `RECEIVED` (validation is synchronous inside the claim) |
| PROCESSING | `IN_PROGRESS` |
| POSTED | `POSTED` |
| SHADOW_POSTED | `SHADOWED` |
| FAILED_RETRYABLE / FAILED_FINAL | `FAILED` + `failureRetryable` boolean |
| DUPLICATE | idempotent replay (no status change) or `ConflictingIdempotencyKeyError` |
| CANCELLED | `REJECTED` / `SUPERSEDED` |

## Uniqueness

- `idempotencyKey` is unique — the database, not application code, is the
  final arbiter of event identity.
- `JournalEntry.accountingEventId` is unique — at most one production journal
  per event.
- One active posting per source/event is additionally guarded by the claim
  transaction (Phase A) which detects `IN_PROGRESS` concurrent claims and
  raises `PostingInProgressError`.
