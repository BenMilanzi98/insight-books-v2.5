# Multi-Tenant Isolation Matrix

Tenant isolation test coverage mapped to **TEN-001**, **TEN-002**, **TEN-003**, **SEC-1**, **SEC-2**, **R-19**, **R-20**, **P6-XTEN-001**, and **GAP-SEC-013/014/026/030**.

---

## Isolation layers

| Layer | Mechanism | Test evidence |
|---|---|---|
| L1 — Posting engine | `CrossTenantAccountingError` | `accountingV2.postingEngine.test.js` ✅ |
| L2 — Accounting context | ADR-005 session-only `businessId` | `accountingV2.domain.test.js`, `tenantScope.test.js` ✅ |
| L3 — Audit detection | TEN-001, TEN-002 rules | `accountingAudit.test.js` 🔍 |
| L4 — Repair anomaly | P6-XTEN-001 | `accountingV2.repair.test.js` ⚠️ |
| L5 — Legacy GL | `postGlEntry` no tenant filter | **NO TEST** ❌ SEC-1 |
| L6 — HTTP IDOR | Query `tenantId` on suppliers | **NO TEST** ❌ SEC-2 |
| L7 — Middleware | `tenantApiAccess` prefix rules | **NO TEST** ❌ GAP-SEC-011 |
| L8 — Database RLS | Not implemented | N/A GAP-SEC-025 deferred |
| L9 — Schema NOT NULL | `tenantId` nullable | audit only TEN-002 |

---

## Finding × test matrix

| ID | Description | Unit test | Integration test | Status |
|---|---|---|---|---|
| **TEN-001** | Cross-tenant journal line → foreign account | `postingEngine.test.js` | `ledger-dual-write.test.js` planned | PARTIAL |
| **TEN-002** | NULL tenantId on financial rows | `accountingAudit.test.js` | post-migration schema test | AUDIT_ONLY |
| **TEN-003** | Unauthorized cross-tenant **read** | — | `supplier-idor.test.js` | NOT_STARTED |
| **SEC-1** | Cross-tenant GL **write** via legacy | V2 only | legacy block test | PARTIAL |
| **SEC-2** | Supplier route IDOR | — | `supplier-idor.test.js` | NOT_STARTED |
| **R-19** | Same as SEC-1 | same | same | PARTIAL |
| **R-20** | Same as SEC-2 | — | same | NOT_STARTED |
| **P6-XTEN-001** | Historical cross-tenant lines | repair anomaly | rehearsal audit | PARTIAL |
| **GAP-SEC-014** | Legacy GL tenancy assertion | — | Phase 15 Q | NOT_STARTED |
| **GAP-SEC-026** | NOT NULL migration | — | migration test | NOT_STARTED |
| **GAP-SEC-030** | Prevent not just detect | policy + engine | full matrix | NOT_STARTED |

---

## Module tenant scoping tests

| Module | Test file | Isolation aspect | Status |
|---|---|---|---|
| Stock / inventory | `tenantStockAccess.test.js` | branch/tenant stock reads | ✅ |
| Tenant scope utils | `tenantScope.test.js` | query scoping helpers | ✅ |
| CoA tenant pipeline | `coaExpenseTenantPipeline.test.js` | expense balances per tenant | skipIf DB |
| V2 boundaries | `accountingV2.boundaries.test.js` | context validation | ✅ |
| Consolidation | `consolidationEngine.test.js` | multi-entity rollup logic | ✅ unit |
| Hidden primary branch | `hiddenPrimaryBranch.test.js` | branch visibility | ✅ |

---

## Cross-tenant test patterns (stub)

V2 tests use:
```javascript
const T1 = 'tenant-1';
const T2 = 'tenant-2';
// draft lines with accountId from T2 while context.businessId = T1 → reject
```

**Engine test:** `evaluateAuthorization` with `resourceBusinessId: 'b2'` → `CROSS_BUSINESS` ✅

---

## Data isolation rules

From `TEST_DATA_ARCHITECTURE.md`:
- Stub tenants T1/T2 never use production IDs
- QA-Accounting is single-tenant read-only scenarios
- Migration rehearsal uses disposable DB clone

---

## Planned `test/qa/` suites

| File | TEN / SEC coverage | Status |
|---|---|---|
| `supplier-idor.test.js` | TEN-003, SEC-2, R-20 | NOT_STARTED |
| `middleware-catalogue.test.js` | TEN-003 surface reduction | NOT_STARTED |
| `ledger-dual-write.test.js` | TEN-001 | NOT_STARTED |
| `posting-sec1-legacy-block.test.js` | SEC-1, R-19 | NOT_STARTED |

---

## PostgreSQL RLS (Phase 16+ / deferred)

**GAP-SEC-025 — DEFERRED.** When evaluated:
- Pilot tables: `JournalEntry`, `Account`, `Transaction`
- Tests must prove legitimate user not locked out (false negative risk per `PHASE_16_READINESS.md`)

No RLS tests until policy implemented.

---

## Exit criteria

| Metric | Target |
|---|---|
| TEN-001 write path blocked | V2 ✅ + legacy test ❌ → both ✅ |
| TEN-003 read IDOR | SEC-2 test ✅ |
| P6-XTEN-001 | 0 critical open on pilot tenant at cutover |
| THR-007, THR-008 automated | 90% bar |

---

## Related

- `docs/accounting-audit/MULTI_TENANT_AND_SECURITY_AUDIT.md`
- `SECURITY_INVARIANT_CATALOGUE.md` SEC-INV-008–010, 034–035
- `AUTHORIZATION_TEST_MATRIX.md`
