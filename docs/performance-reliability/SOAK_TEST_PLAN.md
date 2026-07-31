# Soak Test Plan

Long-duration stability test — memory leaks, connection leaks, cache bloat.

---

## Objectives

- 24h run at **70% of measured sustainable RPS** (from load/stress tests)
- Stable memory and connection count
- No growth in `duplicate_posting_count` or error rate

---

## Duration

| Phase | Length |
|---|---|
| Minimum | 8 hours (CI/nightly candidate) |
| Target | 24 hours |
| Production-like | 72 hours (pre-cutover optional) |

---

## Workload

Loop [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md) L1 scenario with reduced think time.

Include:

- 1 period-close simulation (if staging data permits)
- Hourly cache rebuild API call (admin)

---

## Watch

| Signal | Alert if |
|---|---|
| RSS memory | Monotonic +20% over 4h |
| `db_connections_active` | Monotonic climb |
| `AcctV2ReportCache` row count | Unbounded growth without cleanup policy |
| Event loop lag | Sustained increase |

---

## Pass criteria

- Error rate stable (< 1%)
- No OOM kill
- Post-soak TB reconciliation matches pre-soak checksum

---

## Cross-links

- [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md)
- [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md)
