# Performance Budgets

Per-route resource budgets (DRAFT). **Certify against baseline** — not production guarantees today.

---

## Budget table

| Route / CP | p95 budget (DRAFT) | DB queries (DRAFT max) | Payload max |
|---|---|---|---|
| CP-01 posting | 800 ms | 1 transaction (~15 queries) | 64 KB |
| CP-10 ledger page | 500 ms | 3–5 | 500 lines |
| CP-11 drill-down | 1.5 s | 2 + lines page | 500 lines |
| CP-12 TB warm | 1 s | 1–3 + cache | — |
| CP-12 TB cold | 5 s | aggregation | — |
| CP-30 login | 300 ms | 2–4 | — |

---

## Enforcement

| Stage | Mechanism |
|---|---|
| CI | Smoke k6 against staging — [PERFORMANCE_REGRESSION_GATES.md](./PERFORMANCE_REGRESSION_GATES.md) |
| PR | Warn on > 20% regression vs last baseline |
| Release | Block if correctness budget violated |

---

## Exclusions

- One-off migrations, rebuild endpoints, integrity scans — not user-facing budgets

---

## Cross-links

- [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md)
- [CRITICAL_PATH_INVENTORY.md](./CRITICAL_PATH_INVENTORY.md)
