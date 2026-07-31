# Backpressure

How the platform signals and handles overload.

---

## Signals

| Signal | Threshold (DRAFT) | Action |
|---|---|---|
| DB pool wait > 0 sustained | 5 s | Reject new heavy reports with 503 |
| Event loop lag | > 100 ms p95 | Log + shed non-critical routes |
| CPU > 90% | 2 min | Alert ops |
| `rate_limit_rejected_total` spike | — | Expected under abuse |

Implementation: `lib/performanceReliability/` middleware (in progress).

---

## Response codes

| Code | When |
|---|---|
| 429 | Rate limit ([API_RATE_LIMITING.md](./API_RATE_LIMITING.md)) |
| 503 + `Retry-After` | Pool saturated, deliberate shed |
| 504 | Upstream/DB timeout ([TIMEOUT_POLICY.md](./TIMEOUT_POLICY.md)) |

---

## Shedding priority (high to low)

1. **Never shed:** CP-01 posting (unless DB truly unavailable — return 503, client retries with idempotency key)
2. **Shed first:** Ad-hoc exports, drill-down on huge windows
3. **Queue:** Cron-compatible batch work

---

## Client behavior

Document in API consumers: honor `Retry-After`, use idempotency keys on POST retries.

---

## Cross-links

- [CONNECTION_POOL_MANAGEMENT.md](./CONNECTION_POOL_MANAGEMENT.md)
- [CIRCUIT_BREAKER_POLICY.md](./CIRCUIT_BREAKER_POLICY.md)
