# Performance Bottleneck Register

Known and suspected bottlenecks. **Severity** is architectural assessment — not measured until [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md) is complete.

| ID | Area | Description | Evidence | Mitigation | Status |
|---|---|---|---|---|---|
| BN-01 | Connection pool | Default Prisma pool × N Node processes may exhaust PostgreSQL `max_connections` | No `connection_limit` in `DATABASE_URL`; singleton in `lib/prisma.js` | Size pool per [CONNECTION_POOL_MANAGEMENT.md](./CONNECTION_POOL_MANAGEMENT.md) | Open |
| BN-02 | Report generation | Full TB/P&L recompute on cache miss scans large journal sets | `financialReportService.js`, `trialBalanceService.js` | `AcctV2ReportCache`; projection flag | Partially mitigated |
| BN-03 | Account drill-down | Running balance computed over full window before page slice | Phase 5 doc P5-I04 trade-off | Narrow date window; projection checkpoints (future) | Documented |
| BN-04 | In-memory rate limit | Per-process buckets; uneven under PM2 cluster | `lib/securityGovernance/domain/rateLimit.js` | Redis or edge rate limit at scale | Open |
| BN-05 | No read replica | All read and write traffic to primary PG | Architecture inventory | Read replica + routing (target) | Open |
| BN-06 | Outbox backlog | Enqueue without dispatcher — notification lag, table growth | ARCH-005 in `architectureIntegrityAudit.js` | Dispatcher cron/worker | Open |
| BN-07 | Large schema index count | 554 indexes — write amplification on hot insert paths | `prisma/schema.prisma` | Index review per [INDEX_REVIEW.md](./INDEX_REVIEW.md) | Review pending |
| BN-08 | N+1 queries | Risk in nested Prisma includes on list endpoints | Not systematically audited | [N_PLUS_ONE_AUDIT.md](./N_PLUS_ONE_AUDIT.md) | Pending |
| BN-09 | Cron overlap | Multiple cron routes may coincide | `app/api/cron/*` | Stagger schedules; idempotent cron handlers | Open |
| BN-10 | Docker health mismatch | Dockerfile checks `/api/health` — route missing | `Dockerfile` HEALTHCHECK | `/api/system/health` rollout | In progress |
| BN-11 | Single-node deploy | No horizontal autoscaling in typical VPS/PM2 setup | Deploy docs | [SCALING_STRATEGY.md](./SCALING_STRATEGY.md) | Accepted (pilot) |
| BN-12 | Integrity scan caps | Ledger integrity checks default limit 5000 journals/run | Phase 5 performance notes | Batch scans off-peak | By design |
| BN-13 | Excel/PDF export | Report export builds large buffers in-process | `reportExportService.js` | Stream responses; async export (future) | Open |
| BN-14 | Multi-tenant fairness | One large tenant can starve others on shared DB | No per-tenant concurrency cap today | [TENANT_FAIRNESS.md](./TENANT_FAIRNESS.md) | In progress |

---

## Triage process

1. Reproduce under load test harness ([LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md)).
2. Capture `EXPLAIN (ANALYZE)` for suspect queries ([SLOW_QUERY_WORKFLOW.md](./SLOW_QUERY_WORKFLOW.md)).
3. Update this register and [QUERY_INVENTORY.md](./QUERY_INVENTORY.md).
4. **Never** remove unique constraints or idempotency checks to improve throughput.

---

## Cross-links

- [RELIABILITY_RISK_REGISTER.md](./RELIABILITY_RISK_REGISTER.md)
- [PERFORMANCE_BUDGETS.md](./PERFORMANCE_BUDGETS.md)
