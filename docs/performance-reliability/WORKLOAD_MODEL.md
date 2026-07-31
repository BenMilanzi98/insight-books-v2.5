# Workload Model

Synthetic workload profiles for load, soak, and capacity testing. **All tenant sizes and rates below labeled ASSUMED** unless marked MEASURED in [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md).

---

## Tenant sizing (ASSUMED)

| Profile | Businesses | Users/business | Journals/month | Lines/journal (avg) |
|---|---|---|---|---|
| Micro | 1 | 3 | 500 | 4 |
| SME | 1 | 15 | 5,000 | 6 |
| Growth | 1 | 50 | 25,000 | 8 |
| Platform pilot | 10 | 150 total | 50,000 total | 6 |

---

## User personas

| Persona | Primary actions | Peak pattern (ASSUMED) |
|---|---|---|
| Bookkeeper | Expense entry, invoice, payment | Weekdays 08:00–17:00 |
| Accountant | TB, P&L, drill-down, close | Month-end + year-end spike |
| POS cashier | Sales, partial payment | Retail hours, lunch peak |
| Admin | COA, users, settings | Low frequency |
| Cron | Depreciation, EIS sync, reports | Off-peak scheduled |

---

## API mix — steady state (ASSUMED)

| Operation | % of requests | Critical path |
|---|---|---|
| Authenticated reads (lists, dashboards) | 55% | CP-10, CP-31 |
| Report views (TB, P&L) | 15% | CP-12, CP-13 |
| Posting (invoice, expense, payment) | 20% | CP-01 |
| Ledger drill-down | 5% | CP-11 |
| Admin / config | 5% | Various |

**ASSUMED aggregate:** 2–8 req/s per SME tenant at peak (not certified).

---

## Burst profiles (ASSUMED)

| Scenario | Description | Duration |
|---|---|---|
| POS lunch rush | 3× posting rate | 30 min |
| Month-end close | 5× report generation | 4 hours |
| Payroll day | 1 large batch + 2× reads | 2 hours |
| Import / backfill | Sustained posting | 1–3 hours |

---

## Data volume anchors (ASSUMED)

| Entity | SME (5y history) |
|---|---|
| `JournalEntry` rows | ~300,000 |
| `JournalEntryLine` rows | ~1,800,000 |
| `AcctV2ReportCache` entries | ~50 per tenant |
| Chart of accounts accounts | ~200 active |

---

## Multi-tenant platform (ASSUMED)

| Dimension | Pilot platform |
|---|---|
| Concurrent tenants active | 10 |
| Largest tenant share of DB CPU | 40% (noisy neighbor test target) |
| Cross-tenant requests | 0 (isolation invariant) |

---

## Mapping to test plans

| Profile | Load plan | Stress plan | Soak plan |
|---|---|---|---|
| SME steady | [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md) § SME | [STRESS_TEST_PLAN.md](./STRESS_TEST_PLAN.md) | [SOAK_TEST_PLAN.md](./SOAK_TEST_PLAN.md) |
| Platform pilot | Load plan § multi-tenant | Stress § tenant fairness | Soak 24h |

---

## How to refine

1. Export anonymized request counts from staging access logs (when metrics live).
2. Replace ASSUMED columns with **MEASURED** in baseline report.
3. Update [CAPACITY_MODEL.md](./CAPACITY_MODEL.md) inputs.

---

## Cross-links

- [CRITICAL_PATH_INVENTORY.md](./CRITICAL_PATH_INVENTORY.md)
- [LOAD_TEST_DATA_STRATEGY.md](./LOAD_TEST_DATA_STRATEGY.md)
