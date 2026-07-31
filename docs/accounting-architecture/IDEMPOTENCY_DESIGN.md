# Idempotency Design

## Levels

| Level | Mechanism |
|---|---|
| Accounting-event idempotency | Canonical key + registry unique constraints (primary control) |
| Request idempotency | `requestId` on context; replays of a completed registration return the stored result |
| Webhook idempotency | `webhookEventId` recorded on the source reference/registry; same event → same accounting identity → same key |
| Import-batch idempotency | `importBatchId` recorded; re-imported rows derive identical keys and replay |
| Background-job idempotency | jobs must construct the same `SourceReference`; the key dedupes across workers |

## Canonical key

```
ACCOUNTING:{businessId}:{sourceModule}:{sourceType}:{sourceId}:{eventType}:{eventVersion}
```

Derived in `domain/sourceReference.js#deriveIdempotencyKey`. Stable identity only — no
timestamps, no amounts (Phase 1 showed unstable keys like `{paymentId}-{timestamp}` defeat
dedup, and shared keys like `{saleId}-cogs` collide). Colons in identity parts are rejected.
The key contains internal ids only (cuid/business keys), no personal data.

## Runtime behaviour (`infrastructure/eventRegistryRepository.js#registerEvent`)

1. Look up by key inside the transaction.
2. Exists + content hash differs → `ConflictingIdempotencyKeyError` (409).
3. Exists + active status (`RECEIVED/IN_PROGRESS/POSTED/SHADOWED`) → **safe replay**: return
   the existing registration, `existingPosting: true`.
4. Exists + `FAILED/REJECTED` → reopen the same row for retry (same key, never regenerated).
5. Not found → insert. A concurrent duplicate loses at the **database unique constraint**
   (P2002) and surfaces as `DuplicateAccountingEventError` — application checks are an
   optimization, the constraint is the guarantee.

`commandHash` (sha-256 over ordered material fields: event identity, date, currency, amount,
lines) detects the same key reused with materially different data.

## Test coverage (`test/accountingV2.posting.test.js`)

Double submission replay; concurrent duplicate via simulated race → constraint;
same key + different amount → conflict; same source + different legitimate event type →
separate registrations; retry after failure reuses the registration; failed-attempt reopen;
webhook/import cases are covered by the same identity mechanics (ids ride on the reference).
