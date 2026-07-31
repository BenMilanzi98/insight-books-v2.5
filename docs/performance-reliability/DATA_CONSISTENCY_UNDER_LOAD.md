# Data Consistency Under Load

Accounting invariants that must hold during and after load, stress, and soak tests.

---

## Zero-tolerance invariants

| ID | Invariant | Verification |
|---|---|---|
| DC-01 | No duplicate journals for same idempotency key | Post-test SQL + `duplicate_posting_count` SLI |
| DC-02 | Debits = credits per journal | `test/qa/invariants/accounting.invariants.test.js` + SQL |
| DC-03 | TB debits = credits | API TB after load |
| DC-04 | No cross-tenant rows in journals | Tenant filter audit |
| DC-05 | No stale cache marked current | `sourceDataVersion` check (REP-030) |
| DC-06 | Period closed → no new posts in period | Attempt post → 4xx |

---

## Concurrency scenarios

| Scenario | Setup | Expected |
|---|---|---|
| Parallel same idempotency | N threads, 1 key | 1 journal |
| Parallel different sources | N keys | N journals, all balanced |
| Post during report | Overlap CP-01 + CP-12 | Report eventually consistent; no stale serve |
| Retry after 503 | Client retries POST | DC-01 holds |

Extend [test/qa/failure-injection/failureInjection.test.js](../test/qa/failure-injection/failureInjection.test.js) for load-adjacent cases.

---

## Post-test reconciliation

1. Run `scripts/verify-accounting-scenario.cjs`
2. Architecture integrity audit (ARCH-005 outbox acceptable backlog)
3. Compare TB hash pre vs post load (golden dataset if available)

---

## Failure response

Any DC-01..DC-06 violation → **SEV-1**, halt release, [ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md).

---

## Cross-links

- [LOCKING_AND_CONCURRENCY_MODEL.md](./LOCKING_AND_CONCURRENCY_MODEL.md)
- [quality-assurance/ACCOUNTING_INVARIANT_CATALOGUE.md](../quality-assurance/ACCOUNTING_INVARIANT_CATALOGUE.md)
