# Query Inventory

High-impact query paths and optimization plans. **EXPLAIN plans and measured timings: PENDING.**

---

## Legend

| Status | Meaning |
|---|---|
| DESIGNED | Strategy documented in prior phase |
| PENDING | Needs EXPLAIN + baseline |
| OPTIMIZED | Change merged + verified |

---

## CP-01 — Posting engine

| Attribute | Value |
|---|---|
| Service | `lib/accountingV2/engine/postingEngine.js` |
| Pattern | Single `$transaction`: journal insert, lines, event registry, source update, audit, outbox |
| Indexes | `JournalEntry (tenantId, sourceType, sourceId)`, event registry unique keys |
| Status | **DESIGNED** — atomic persistence |
| Plan | PENDING — measure tx duration under 10 concurrent posters |

---

## CP-10 — Ledger summary

| Attribute | Value |
|---|---|
| Service | `lib/accountingV2/ledger/ledgerQueryService.js` |
| Pattern | `groupBy` sums; no full line enumeration for balances |
| Reference | [accounting-ledger/PERFORMANCE_VALIDATION.md](../accounting-ledger/PERFORMANCE_VALIDATION.md) |
| Status | **DESIGNED** |
| Plan | PENDING — EXPLAIN on largest SME tenant |

---

## CP-11 — Account drill-down

| Attribute | Value |
|---|---|
| Service | `ledgerQueryService.js` |
| Pattern | Load lines for window; compute running balance; page max 500 |
| Risk | Large windows on active accounts (BN-03) |
| Status | **DESIGNED** with documented trade-off |
| Plan | PENDING — projection checkpoint follow-up |

---

## CP-12 — Trial balance

| Attribute | Value |
|---|---|
| Service | `lib/accountingV2/reporting/trialBalanceService.js` |
| Pattern | Aggregation over canonical ledger; optional `AcctV2LedgerBalance` projection |
| Status | **DESIGNED** |
| Plan | PENDING — cold vs warm; flag on/off comparison |

---

## CP-13 — Financial statements

| Attribute | Value |
|---|---|
| Service | `lib/accountingV2/reporting/financialReportService.js` |
| Pattern | Delegates to TB + statement builders; cache read-through |
| Cache | `AcctV2ReportCache` via `reportCacheService.js` |
| Status | **DESIGNED** |
| Plan | PENDING — cache hit ratio under steady load |

---

## CP-20 — POS posting (legacy adapter path)

| Attribute | Value |
|---|---|
| Entry | Invoice/sale APIs → adapters → posting engine |
| Status | **PENDING** |
| Plan | Trace adapter + CP-01 combined duration |

---

## CP-22 — Bank reconciliation candidates

| Attribute | Value |
|---|---|
| Entry | `app/api/bank-reconciliation/candidates/route.js` |
| Status | **PENDING** |
| Plan | Index review on match candidate queries |

---

## Maintenance queries

| Query | Service | Plan |
|---|---|---|
| Ledger rebuild | `ledgerRebuildService.js` | PENDING — batch size vs memory |
| Report cache reconcile | `reportCacheService.js` | Off-peak only |
| Integrity scan | `ledgerReconciliationService.js` | Cap 5000/run by design |

---

## Optimization policy

1. Prefer query shape fixes and indexes over caching financial truth
2. Any new index: review write amplification ([INDEX_REVIEW.md](./INDEX_REVIEW.md))
3. Record before/after in [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md)

---

## Cross-links

- [WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md)
- [PERFORMANCE_BOTTLENECK_REGISTER.md](./PERFORMANCE_BOTTLENECK_REGISTER.md)
