# Phase 17 Tasks — Performance & Reliability

| Field | Value |
|---|---|
| Phase | 17 |
| Docs/scaffolding | **DONE** |
| Measured load / soak / capacity | **CERTIFICATION PENDING** |
| Owner | Platform / SRE + Accounting |

---

## Workstream summary

| ID | Workstream | Deliverable | Status |
|---|---|---|---|
| P17-PR-A | Documentation tree | `docs/performance-reliability/**` | **DONE** |
| P17-PR-B | Runtime module | `lib/performanceReliability/*` | **IN PROGRESS** (parallel) |
| P17-PR-C | Health endpoints | `/api/system/health`, `/ready`, `/live` | **IN PROGRESS** |
| P17-PR-D | Request metrics | Middleware + [REQUIRED_METRICS.md](./REQUIRED_METRICS.md) | **IN PROGRESS** |
| P17-PR-E | Tenant fairness guards | [TENANT_FAIRNESS.md](./TENANT_FAIRNESS.md) | **IN PROGRESS** |
| P17-PR-F | Load harness | k6 or autocannon scripts | **NOT STARTED** |
| P17-PR-G | Baseline capture | [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md) | **PENDING** |
| P17-PR-H | Load test execution | [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md) | **PENDING** |
| P17-PR-I | Soak test execution | [SOAK_TEST_PLAN.md](./SOAK_TEST_PLAN.md) | **PENDING** |
| P17-PR-J | Capacity certification | [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md) | **NOT CERTIFIED** |
| P17-PR-K | Pool sizing validation | [CONNECTION_POOL_MANAGEMENT.md](./CONNECTION_POOL_MANAGEMENT.md) | **PENDING** |
| P17-PR-L | Query EXPLAIN plans | [QUERY_INVENTORY.md](./QUERY_INVENTORY.md) | **PENDING** |
| P17-PR-M | Outbox dispatcher | Cron/worker for outbox | **NOT STARTED** |
| P17-PR-N | Regression gates in CI | [PERFORMANCE_REGRESSION_GATES.md](./PERFORMANCE_REGRESSION_GATES.md) | **NOT STARTED** |
| P17-PR-O | Phase 18 handoff | [PHASE_18_READINESS.md](./PHASE_18_READINESS.md) | **DRAFT** |

---

## Dependencies

| From | Gate |
|---|---|
| Phase 16 QA | Failure injection tests exist (`test/qa/failure-injection/`) |
| Phase 15 security | Rate limit module in production paths |
| Staging DB | Realistic data for load tests ([LOAD_TEST_DATA_STRATEGY.md](./LOAD_TEST_DATA_STRATEGY.md)) |

---

## Non-goals (Phase 17)

- Removing DB constraints for speed
- Declaring production SLOs as **certified** without baseline
- Multi-region HA (documented as future in [HIGH_AVAILABILITY_ARCHITECTURE.md](./HIGH_AVAILABILITY_ARCHITECTURE.md))

---

## Exit criteria

1. All **MUST** docs in [README.md](./README.md) present and cross-linked.
2. Health + metrics shipped and wired to [ALERTING.md](./ALERTING.md) (minimum: DB down, error rate).
3. Load + soak tests executed once; results recorded in baseline report (numbers labeled **MEASURED**).
4. [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md) signed or explicitly **NOT CERTIFIED** with date.
5. [FINAL_PHASE_17_REPORT.md](./FINAL_PHASE_17_REPORT.md) published.

---

## Cross-links

- [quality-assurance/PHASE_17_READINESS.md](../quality-assurance/PHASE_17_READINESS.md) — QA track (E2E, coverage)
- [PLATFORM_PERFORMANCE_READINESS.md](./PLATFORM_PERFORMANCE_READINESS.md)
