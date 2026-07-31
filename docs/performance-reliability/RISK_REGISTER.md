# Risk Register — Performance & Reliability

Combined view. Detail in specialized registers.

---

## Performance risks

See [PERFORMANCE_BOTTLENECK_REGISTER.md](./PERFORMANCE_BOTTLENECK_REGISTER.md) (BN-*).

| Priority | IDs |
|---|---|
| High | BN-01, BN-02, BN-05 |
| Medium | BN-03, BN-04, BN-06, BN-08, BN-14 |

---

## Reliability risks

See [RELIABILITY_RISK_REGISTER.md](./RELIABILITY_RISK_REGISTER.md) (PR-*).

| Priority | IDs |
|---|---|
| Critical | PR-08 (mitigated), PR-09 (open) |
| High | PR-01, PR-02, PR-06 (mitigated) |

---

## Cross-phase risks (reference only)

| ID | Source | Note |
|---|---|---|
| P2-06 | [accounting-architecture/RISK_REGISTER.md](../accounting-architecture/RISK_REGISTER.md) | Outbox dispatcher |
| QA-R12 | [quality-assurance/RISK_REGISTER.md](../quality-assurance/RISK_REGISTER.md) | E2E absence |

---

## Review cadence

- After each load test
- Before Phase 18 cutover
- Quarterly in production

---

## Cross-links

- [ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md)
- [PHASE_17_TASKS.md](./PHASE_17_TASKS.md)
