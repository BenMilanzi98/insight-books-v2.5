# Concurrency Control

## Mechanisms used

| Mechanism | Where |
| --- | --- |
| Unique constraints | `AcctV2EventRegistry.idempotencyKey`; `JournalEntry(tenantId, journalNumber)`; `JournalEntry.accountingEventId`; `AcctV2JournalSequence(tenantId, scopeKey)`; `AcctV2OpeningBalanceBatch(tenantId, effectiveDate, version)` |
| Atomic state transitions | Event registry updates use guarded `updateMany`-style transitions (`assertEventStatusTransition`); the `IN_PROGRESS` claim is a compare-and-set inside Phase A |
| Atomic increment | `AcctV2JournalSequence.lastValue` is incremented with a single row-level `update` inside the posting transaction (row lock serializes concurrent allocations per scope) |
| Transaction scoping | All financial writes for one posting occur in one Prisma transaction (`infrastructure/transactionBoundary.js`); no external network calls inside it |
| Two-phase claim | The short claim transaction narrows the race window to a single unique insert — no broad business-wide locks are taken |

Advisory locks and serializable isolation were evaluated and not required:
the unique-key claim plus row-locked sequence rows provide exactly-once
semantics without blocking unrelated postings for the same business.

## Race outcomes

| Race | Survivor |
| --- | --- |
| Two identical postings (double click, two tabs, retries) | One journal; second caller gets replay or `PostingInProgressError` |
| Two conflicting commands, same identity | First wins; second gets `ConflictingIdempotencyKeyError` |
| Posting vs. legacy posting for the same source | Loser blocked by `legacyGuard` in whichever direction lost |
| Approval vs. cancellation | Journal status machine (`journalStatus.js`) permits only one transition from `PENDING_APPROVAL`; the second actor receives an invalid-transition error |
| Posting vs. reversal | `POSTED` journals refuse legacy void/reversal; V2 reversal claims a **new** event identity, so it cannot collide with the original posting |
| Import vs. manual posting / webhook vs. user | Same canonical identity → idempotency layer resolves |

## Tests

`test/accountingV2.postingEngine.test.js` covers sequential + simulated
concurrent duplicates, conflicting-command rejection, in-progress detection,
status-transition refusals, and the legacy/new mutual exclusion in both
directions. The in-memory Prisma stub enforces the same unique constraints as
the database so unique-violation paths are exercised.
