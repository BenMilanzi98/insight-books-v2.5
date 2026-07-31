# Idempotency Implementation

Implementation: `lib/accountingV2/engine/postingEngine.js` (claim phase),
`lib/accountingV2/engine/postingCommand.js` (key + hash),
`AcctV2EventRegistry` unique constraint.

## Canonical identity

```
ACCOUNTING:{businessId}:{sourceModule}:{sourceType}:{sourceId}:{eventType}:{eventVersion}
```

Generated server-side by `createPostingCommand` when the caller does not
supply a key; caller-supplied keys are validated against the same shape.

## Enforcement layers

1. **Database uniqueness** — `AcctV2EventRegistry.idempotencyKey` is a unique
   column. Two concurrent inserts for the same identity cannot both succeed;
   the loser receives the unique-violation and re-reads the winner's row.
2. **Claim transaction (Phase A)** — the engine registers/loads the event and
   transitions it to `IN_PROGRESS` in a short dedicated transaction before any
   financial writes. Outcomes:
   - No existing row → insert claim, proceed to posting.
   - Existing `POSTED` row + matching command hash → return the original
     result (`wasExistingPosting: true`). **No second journal.**
   - Existing row + different command hash → `ConflictingIdempotencyKeyError`
     (materially different command reusing an identity).
   - Existing `IN_PROGRESS` row → `PostingInProgressError` (retryable).
   - Existing `FAILED` row → retry only if `failureRetryable`, reusing the
     same identity and incrementing `attemptCount`.
3. **Journal-side uniqueness** — `JournalEntry.accountingEventId` unique
   constraint makes a duplicate journal for one event impossible even if
   application logic were bypassed.

## Behaviour matrix

| Scenario | Outcome |
| --- | --- |
| Sequential duplicate request | Original result replayed |
| Concurrent duplicate request | One posts; other gets replay or `PostingInProgressError` |
| Same key, changed amount | `ConflictingIdempotencyKeyError` (command hash mismatch) |
| Same source, different event type | Distinct identity — both allowed |
| Same source, new event version | Distinct identity — allowed |
| Webhook / import / worker retry | Same key → replay or safe retry |
| Retry after temporary failure | Allowed (`failureRetryable = true`), same identity |
| Retry after success | Replay of original result |
| Retry after fatal failure | Refused (`retryPosting` throws) |

Explicitly **not** relied upon: frontend button disabling, in-memory locks,
pre-insert existence queries alone, timestamps, or amount matching.

Tests: `test/accountingV2.postingEngine.test.js` — idempotency and duplicate
suites; conflicting-hash and in-progress cases included.
