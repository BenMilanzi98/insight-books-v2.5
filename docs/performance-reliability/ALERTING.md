# Alerting

Alert rules for InsightBooks V2. Thresholds **DRAFT** until baseline exists.

---

## Severity

| Level | Response |
|---|---|
| SEV-1 | Page on-call — financial correctness or total outage |
| SEV-2 | Slack/email — degraded SLO |
| SEV-3 | Ticket — warning trend |

---

## Rules

| Alert | Condition | Severity |
|---|---|---|
| DuplicatePosting | `duplicate_posting_total` increase | **SEV-1** |
| ReadyDown | `health_ready == 0` for 2 min | SEV-1 |
| HighErrorRate | 5xx > 5% for 5 min | SEV-2 |
| PostingLatency | p95 > 2× draft SLO for 10 min | SEV-2 |
| PoolExhaustion | `db_pool_waiting > 0` for 1 min | SEV-2 |
| OutboxBacklog | pending > 100 OR oldest > 24h (ARCH-005) | SEV-3 |
| DiskSpace | > 85% | SEV-2 |
| EventLoopLag | p95 > 200ms for 5 min | SEV-3 |

---

## Runbook links

Each alert links to [OPERATIONAL_RUNBOOKS.md](./OPERATIONAL_RUNBOOKS.md) section.

---

## Noise control

- Require `for: 2m` on latency alerts
- Suppress during approved maintenance window

---

## Cross-links

- [ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md)
- [SYNTHETIC_MONITORING.md](./SYNTHETIC_MONITORING.md)
