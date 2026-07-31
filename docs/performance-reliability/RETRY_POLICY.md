# Retry Policy

When and how InsightBooks V2 retries operations. **Posting idempotency must survive retries.**

---

## HTTP client retries (callers)

| Condition | Retry | Max attempts | Backoff |
|---|---|---|---|
| 503 / 502 / network reset | Yes | 3 | Exponential 100ms–2s + jitter |
| 429 | Yes | After `Retry-After` | Respect header |
| 400 / 401 / 403 / 404 | No | — | Fix request |
| 409 conflict (idempotent replay) | No | — | Treat as success if idempotency key matches |

---

## Server-side posting

| Case | Behavior |
|---|---|
| Idempotency key duplicate | Return prior result — **not** a retry of work |
| P2002 unique violation (race) | Map to idempotent success per posting engine |
| P2034 transaction conflict | Safe retry **only** if client sends same idempotency key |
| Validation failure | No retry |

Reference: [accounting-posting-engine/ERROR_AND_RETRY_ARCHITECTURE.md](../accounting-posting-engine/ERROR_AND_RETRY_ARCHITECTURE.md), `lib/accountingV2/engine/retryPolicy.js`.

---

## Outbox dispatcher (future)

| Field | Policy |
|---|---|
| Max attempts | 10 (DRAFT) |
| Backoff | Exponential, cap 1 hour |
| Poison message | Move to dead state + alert |

Today: enqueue only — see [ASYNC_AND_OUTBOX_PROCESSING.md](./ASYNC_AND_OUTBOX_PROCESSING.md).

---

## Cron jobs

- Handlers **must** be idempotent (safe if cron fires twice)
- On failure: log + alert; next schedule retries

---

## Load test note

Retries under load must not increase `duplicate_posting_count` ([ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md)).

---

## Cross-links

- [TIMEOUT_POLICY.md](./TIMEOUT_POLICY.md)
- [IDEMPOTENCY_UNDER_LOAD.md](./IDEMPOTENCY_UNDER_LOAD.md)
