# Outbox Pattern Audit

| Outbox | Plane | Reuse for BI? |
|--------|-------|---------------|
| `AcctV2Outbox` | Accounting V2 | **No** — accounting isolation |
| `MraEisOutbox` | MRA EIS compliance | **No** — fiscal/compliance isolation |
| `AnalyticsOutbox` (new) | Platform analytics | **Yes** — exclusive BI path |

**Pattern to copy from MraEisOutbox:** idempotencyKey, checksum, claim/lease, attemptCount, correlationId, status machine.

**Transport v1:** same DB + dispatcher cron/API — no external broker required.
