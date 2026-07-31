# Transaction Boundary

Implementation: `lib/accountingV2/infrastructure/transactionBoundary.js`.

`runInAccountingTransaction(prisma, context, work, options)` wraps `prisma.$transaction`:

- The transaction client `tx` is passed explicitly to `work`; repositories call
  `assertTransactionClient(tx)` and throw if handed the root client (prevents writes
  escaping the transaction and nested-transaction inconsistencies).
- Any thrown error rolls back everything: registry row, posting attempt, shadow journal,
  comparison, outbox message, audit write — all-or-nothing (verified by test: simulated
  failure in the last write leaves zero rows in every table).
- Retry: only errors classified transient by `classifyError` (Prisma P2034/P1017/P2024,
  Postgres 40001/40P01) are retried, up to 3 attempts. Business/validation failures are
  never retried. The idempotency key is derived before the boundary and never regenerated,
  so a retry can only replay, never duplicate.
- `onAttempt` hook reports attempt number, status, duration, request/correlation ids for
  observability.

Posting sequence inside one transaction (transition coordinator):

1. Source validation (draft structure validated before boundary; account tenancy inside)
2. Event registration (identity + idempotency, DB-enforced)
3. Mode-specific work: shadow journal + comparison, or legacy delegation
4. Registry status transition
5. Posting-attempt record
6. Outbox message
7. Commit

Tests (`test/accountingV2.posting.test.js` — transaction boundary block): full rollback on
late-step failure; no retry on validation error; retry-then-commit on transient error with the
same work; no duplicate registrations after retry; root-client rejection.
