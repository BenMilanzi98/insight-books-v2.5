# Phase 17 — Performance & Reliability

Documentation for InsightBooks V2 platform performance, capacity, reliability, and operational readiness.

| Field | Value |
|---|---|
| Phase | 17 — Performance & Reliability |
| Status | **Docs/scaffolding DONE**; measured load/soak/capacity **CERTIFICATION PENDING** |
| Runtime module | `lib/performanceReliability/` (health, metrics, fairness, load harness) |
| QA predecessor | [Phase 16 QA](../quality-assurance/FINAL_PHASE_16_REPORT.md) |
| Successor | [Phase 18 Readiness](./PHASE_18_READINESS.md) |

---

## Scope

- **Performance:** workload models, query inventory, capacity formulas, test plans, regression gates.
- **Reliability:** SLOs (draft), error budgets, DR runbooks, consistency under load.
- **Observability:** metrics, dashboards, alerting, database observability.
- **Operations:** health checks, graceful shutdown, runbooks, rollback.

**Policy:** Accounting correctness is never traded for speed — no constraint removal, no duplicate posting tolerance.

---

## Document map

### Architecture & inventory

| Document | Purpose |
|---|---|
| [CURRENT_PERFORMANCE_ARCHITECTURE.md](./CURRENT_PERFORMANCE_ARCHITECTURE.md) | Verified as-built stack |
| [TARGET_PERFORMANCE_ARCHITECTURE.md](./TARGET_PERFORMANCE_ARCHITECTURE.md) | End-state design |
| [CRITICAL_PATH_INVENTORY.md](./CRITICAL_PATH_INVENTORY.md) | Hot paths and APIs |
| [PHASE_1_TO_16_EVIDENCE_INDEX.md](./PHASE_1_TO_16_EVIDENCE_INDEX.md) | Cross-phase evidence links |

### Models & targets

| Document | Purpose |
|---|---|
| [WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md) | User/API profiles (ASSUMED sizes labeled) |
| [CAPACITY_MODEL.md](./CAPACITY_MODEL.md) | Pool and throughput formulas |
| [SERVICE_LEVEL_INDICATORS.md](./SERVICE_LEVEL_INDICATORS.md) | SLI definitions |
| [SERVICE_LEVEL_OBJECTIVES.md](./SERVICE_LEVEL_OBJECTIVES.md) | Draft SLO targets |
| [ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md) | Budget burn and zero-tolerance rules |

### Database & queries

| Document | Purpose |
|---|---|
| [QUERY_INVENTORY.md](./QUERY_INVENTORY.md) | High-impact services and plans |
| [DATABASE_OBSERVABILITY.md](./DATABASE_OBSERVABILITY.md) | PG monitoring |
| [CONNECTION_POOL_MANAGEMENT.md](./CONNECTION_POOL_MANAGEMENT.md) | Prisma pool vs `max_connections` |
| [LOCKING_AND_CONCURRENCY_MODEL.md](./LOCKING_AND_CONCURRENCY_MODEL.md) | Transactions and races |
| [INDEX_REVIEW.md](./INDEX_REVIEW.md) | Index audit stub → [QUERY_INVENTORY](./QUERY_INVENTORY.md) |

### Caching, limits, resilience

| Document | Purpose |
|---|---|
| [CACHE_ARCHITECTURE.md](./CACHE_ARCHITECTURE.md) | `AcctV2ReportCache`, tenant keys |
| [RETRY_POLICY.md](./RETRY_POLICY.md) | Retries and idempotency |
| [TIMEOUT_POLICY.md](./TIMEOUT_POLICY.md) | Client and server timeouts |
| [TENANT_FAIRNESS.md](./TENANT_FAIRNESS.md) | Multi-tenant isolation under load |
| [BACKPRESSURE.md](./BACKPRESSURE.md) | Overload handling |
| [PAGINATION_STRATEGY.md](./PAGINATION_STRATEGY.md) | Bounded page sizes |

### Health & availability

| Document | Purpose |
|---|---|
| [HEALTH_CHECKS.md](./HEALTH_CHECKS.md) | `/api/system/health`, `/ready`, `/live` |
| [GRACEFUL_SHUTDOWN.md](./GRACEFUL_SHUTDOWN.md) | Drain and SIGTERM |
| [HIGH_AVAILABILITY_ARCHITECTURE.md](./HIGH_AVAILABILITY_ARCHITECTURE.md) | Current single-node reality |
| [RECOVERY_OBJECTIVES.md](./RECOVERY_OBJECTIVES.md) | Draft RPO/RTO |
| [DISASTER_RECOVERY_RUNBOOK.md](./DISASTER_RECOVERY_RUNBOOK.md) | Restore procedures |

### Testing & certification

| Document | Purpose |
|---|---|
| [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md) | Steady-state load |
| [STRESS_TEST_PLAN.md](./STRESS_TEST_PLAN.md) | Breaking point |
| [SOAK_TEST_PLAN.md](./SOAK_TEST_PLAN.md) | Long-run stability |
| [CAPACITY_TEST_PLAN.md](./CAPACITY_TEST_PLAN.md) | Headroom certification |
| [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md) | Pending measurement |
| [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md) | **NOT CERTIFIED** template |
| [DATA_CONSISTENCY_UNDER_LOAD.md](./DATA_CONSISTENCY_UNDER_LOAD.md) | Invariants under concurrency |

### Observability & ops

| Document | Purpose |
|---|---|
| [PRODUCTION_OBSERVABILITY.md](./PRODUCTION_OBSERVABILITY.md) | Observability stack |
| [REQUIRED_METRICS.md](./REQUIRED_METRICS.md) | Metric catalogue |
| [OBSERVABILITY_DASHBOARDS.md](./OBSERVABILITY_DASHBOARDS.md) | Dashboard specs |
| [ALERTING.md](./ALERTING.md) | Alert rules |
| [OPERATIONAL_RUNBOOKS.md](./OPERATIONAL_RUNBOOKS.md) | Symptom → action index |

### Governance & handoff

| Document | Purpose |
|---|---|
| [PERFORMANCE_BOTTLENECK_REGISTER.md](./PERFORMANCE_BOTTLENECK_REGISTER.md) | Known bottlenecks |
| [RELIABILITY_RISK_REGISTER.md](./RELIABILITY_RISK_REGISTER.md) | Reliability risks |
| [RISK_REGISTER.md](./RISK_REGISTER.md) | Combined register |
| [PERFORMANCE_BUDGETS.md](./PERFORMANCE_BUDGETS.md) | Per-route budgets |
| [PERFORMANCE_REGRESSION_GATES.md](./PERFORMANCE_REGRESSION_GATES.md) | CI/release gates |
| [SCALING_STRATEGY.md](./SCALING_STRATEGY.md) | Vertical/horizontal path |
| [COST_AND_CAPACITY_ANALYSIS.md](./COST_AND_CAPACITY_ANALYSIS.md) | Cost vs headroom |
| [ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md) | Perf-related rollback |
| [PHASE_17_TASKS.md](./PHASE_17_TASKS.md) | Task tracker |
| [PLATFORM_PERFORMANCE_READINESS.md](./PLATFORM_PERFORMANCE_READINESS.md) | Go/no-go checklist |
| [PHASE_18_READINESS.md](./PHASE_18_READINESS.md) | Handoff to cutover |
| [FINAL_PHASE_17_REPORT.md](./FINAL_PHASE_17_REPORT.md) | Phase summary |

### Supplementary stubs (§105)

See also: [ASYNC_AND_OUTBOX_PROCESSING.md](./ASYNC_AND_OUTBOX_PROCESSING.md), [READ_REPLICA_STRATEGY.md](./READ_REPLICA_STRATEGY.md), [N_PLUS_ONE_AUDIT.md](./N_PLUS_ONE_AUDIT.md), [API_RATE_LIMITING.md](./API_RATE_LIMITING.md), [CIRCUIT_BREAKER_POLICY.md](./CIRCUIT_BREAKER_POLICY.md), [CHAOS_AND_FAILURE_INJECTION.md](./CHAOS_AND_FAILURE_INJECTION.md), [PERFORMANCE_TEST_ENVIRONMENT.md](./PERFORMANCE_TEST_ENVIRONMENT.md), [LOAD_TEST_DATA_STRATEGY.md](./LOAD_TEST_DATA_STRATEGY.md), [SYNTHETIC_MONITORING.md](./SYNTHETIC_MONITORING.md), [APM_AND_TRACING.md](./APM_AND_TRACING.md), [SLOW_QUERY_WORKFLOW.md](./SLOW_QUERY_WORKFLOW.md), [INDEX_MAINTENANCE.md](./INDEX_MAINTENANCE.md), [MATERIALIZED_PROJECTION_STRATEGY.md](./MATERIALIZED_PROJECTION_STRATEGY.md), [BATCH_PROCESSING_STRATEGY.md](./BATCH_PROCESSING_STRATEGY.md), [COLD_START_AND_BUILD_PERFORMANCE.md](./COLD_START_AND_BUILD_PERFORMANCE.md), [CDN_AND_STATIC_DELIVERY.md](./CDN_AND_STATIC_DELIVERY.md), [MEMORY_AND_CPU_PROFILING.md](./MEMORY_AND_CPU_PROFILING.md), [IDEMPOTENCY_UNDER_LOAD.md](./IDEMPOTENCY_UNDER_LOAD.md).

---

## Related docs outside this folder

- [accounting-ledger/PERFORMANCE_VALIDATION.md](../accounting-ledger/PERFORMANCE_VALIDATION.md) — Phase 5 ledger query strategy
- [accounting-reports/REPORT_CACHE.md](../accounting-reports/REPORT_CACHE.md) — report cache semantics
- [accounting-posting-engine/TRANSACTIONAL_OUTBOX.md](../accounting-posting-engine/TRANSACTIONAL_OUTBOX.md) — outbox contract
- [quality-assurance/PHASE_17_READINESS.md](../quality-assurance/PHASE_17_READINESS.md) — QA Phase 17 (test expansion)
