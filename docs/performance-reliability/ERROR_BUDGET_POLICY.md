# Error Budget Policy

How InsightBooks V2 consumes and protects error budgets under [SERVICE_LEVEL_OBJECTIVES.md](./SERVICE_LEVEL_OBJECTIVES.md).

---

## Budget classes

| Class | Budget | Policy |
|---|---|---|
| **Correctness** | **Zero** | Any duplicate posting, stale financial cache served, or cross-tenant leak → immediate incident, freeze releases |
| **Availability** | Per SLO (DRAFT 99.5%) | Burn tracked via failed `/ready` probes |
| **Latency** | DRAFT 5% above p95 | Investigate if sustained 1 hour |
| **Background lag** | DRAFT outbox age | Warn at 50% budget, page at 100% |

---

## Duplicate posting — zero tolerance

```
IF duplicate_posting_count > 0 THEN
  severity = SEV-1
  action = halt financial releases + root cause within 24h
  budget = NOT applicable (invariant violation)
```

**Never** relax idempotency constraints, unique indexes, or event registry checks to recover latency budget.

Verified by:

- `test/accountingV2.postingEngine.test.js`
- [DATA_CONSISTENCY_UNDER_LOAD.md](./DATA_CONSISTENCY_UNDER_LOAD.md)
- `duplicate_posting_count` SLI

---

## Budget burn calculation (availability)

```
error_budget_minutes = (1 - SLO) × window_minutes
burned = downtime_minutes + (degraded_minutes × weight)
```

Degraded = `/ready` 503 but `/live` 200 (weight 0.5 suggested).

---

## Release gates

| Burn level | Action |
|---|---|
| < 25% consumed | Normal releases |
| 25–50% | Require perf review on risky changes |
| 50–75% | Freeze non-critical deploys |
| > 75% | Incident review before any deploy |

Correctness violations **override** all gates — no release until resolved.

---

## Exemptions

- Planned maintenance (announced, off-peak) — excluded from availability budget with change ticket
- Load test in staging — never counts against production budget

---

## Cross-links

- [ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md)
- [OPERATIONAL_RUNBOOKS.md](./OPERATIONAL_RUNBOOKS.md)
