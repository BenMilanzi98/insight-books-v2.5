# Locking and Concurrency Model

How InsightBooks V2 handles concurrent writes and reads on PostgreSQL 15.

---

## Posting transactions (CP-01)

- **Scope:** Single Prisma `$transaction` per post
- **Isolation:** PostgreSQL default `READ COMMITTED`
- **Uniqueness:** Idempotency via `AcctV2EventRegistry` unique constraints — concurrent duplicate posts → one succeeds, others get constraint error (handled as idempotent success or conflict)
- **Policy:** Never reduce isolation or drop constraints for throughput

See [accounting-posting-engine/ATOMIC_PERSISTENCE.md](../accounting-posting-engine/ATOMIC_PERSISTENCE.md).

---

## Read vs write

| Operation | Locking expectation |
|---|---|
| Ledger read | MVCC snapshot — no explicit locks |
| Report generation | Read-only queries; may see committed posts mid-report — version fingerprint detects staleness |
| Period close | Updates period row + snapshots — serializes close for same period |
| Repair batch | Row-level locks on affected journals |

---

## Hot row contention

| Resource | Contention scenario | Mitigation |
|---|---|---|
| Journal numbering | Sequential number per tenant/period | DB sequence or locked counter in tx |
| Same source repost | Idempotency key | Unique index — intentional |
| Period status | Two admins close same period | Optimistic check + status history |

---

## Application-level concurrency

| Mechanism | Status |
|---|---|
| Tenant fairness semaphore | `lib/performanceReliability/` (in progress) |
| In-memory rate limit | Per-process — not cluster-wide |
| Outbox enqueue | Same transaction as post — no race |

---

## Load testing requirements

Verify under [DATA_CONSISTENCY_UNDER_LOAD.md](./DATA_CONSISTENCY_UNDER_LOAD.md):

1. N parallel posts same idempotency key → exactly one journal
2. N parallel posts different sources → all succeed, balanced debits/credits
3. Read during write → no unbalanced TB after quiesce

---

## Deadlock handling

- Prisma surfaces `P2034` transaction conflict — retry policy in [RETRY_POLICY.md](./RETRY_POLICY.md)
- Log deadlocks from `pg_stat_database` — investigate query order

---

## Cross-links

- [IDEMPOTENCY_UNDER_LOAD.md](./IDEMPOTENCY_UNDER_LOAD.md)
- [ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md)
