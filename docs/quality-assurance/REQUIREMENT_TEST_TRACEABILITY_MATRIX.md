# Requirement Test Traceability Matrix

Maps **key finding and gap IDs** to **existing** and **planned** automated tests. Status values: **EXISTS** | **PARTIAL** | **FAILING** | **NOT_STARTED** | **AUDIT_ONLY**.

---

## Security findings

| Requirement ID | Description | Existing test | Planned test (`test/qa/`) | Status |
|---|---|---|---|---|
| SEC-1 | Legacy GL no cross-tenant account posting | `accountingV2.postingEngine.test.js` (V2 path) | Legacy block list test | PARTIAL |
| SEC-2 | Supplier routes reject query `tenantId` | — | `supplier-idor.test.js` | NOT_STARTED |
| SEC-3 | Reversal endpoint RBAC | `authz.test.js` (helper) | `reversal-authz.test.js` | NOT_STARTED |
| SEC-4 | Capital routes enforce permissions | — | `capital-authz.test.js` | NOT_STARTED |
| TEN-001 | No cross-tenant journal lines | `accountingV2.postingEngine.test.js`, audit engine | `ledger-dual-write.test.js` | PARTIAL |
| TEN-002 | No NULL tenant on financial rows | `accountingAudit.test.js` (audit) | Schema migration test post GAP-SEC-026 | AUDIT_ONLY |
| TEN-003 | No unauthorized financial access | — | SEC-2/3/4 integration suite | NOT_STARTED |

---

## Risk register (R-01 – R-25, selected)

| ID | Existing test | Planned | Status |
|---|---|---|---|
| R-01 | `accountingAudit.test.js`, `accountingV2.ledger.test.js` | migration regression | PARTIAL |
| R-02 | `glReconciliation.test.js`, audit GL-002 | concurrency test | PARTIAL |
| R-03 | `accountingV2.postingEngine.test.js` | — | EXISTS |
| R-04 | `verify-accounting-scenario.cjs` (ar-subledger) | API integration | PARTIAL |
| R-05 | audit AP-004 | `liability-journal-link.test.js` | NOT_STARTED |
| R-06 | `accountingV2.reports.test.js` (MK1M) | — | FAILING |
| R-07 | `accountingV2.periods.test.js` | boundary UTC cases | FAILING |
| R-19 | V2 posting tenancy | legacy hotfix test | PARTIAL |
| R-20 | — | `supplier-idor.test.js` | NOT_STARTED |
| R-21 | `authz.test.js` | route tests | NOT_STARTED |
| R-22–25 | `accountingEngine.test.js` | V2 adapter migration | FAILING |

---

## CoA & reporting findings

| ID | Existing test | Status |
|---|---|---|
| TB-003 | `accountingAudit.test.js`, `coaRollupInventory.test.js` | PARTIAL |
| CAP-005 | `accountingAudit.test.js`, `accountingV2.reports.test.js` | FAILING (reports) |
| SAL-DUP / 5200 | `legacyExpenseAccountRemaps.test.js`, `malawiTaxUtilsPayroll.test.js`, `coaMigration.test.js` | PARTIAL |
| 5000 header | `incomeStatementOperatingExpenseRollup.test.js` | FAILING |
| EQT-035 | `equityManagement.domain.test.js`, `equityManagement.workflows.test.js` | EXISTS |

---

## Module-specific

| ID | Module | Existing test | Status |
|---|---|---|---|
| LRD-017 | Loan readiness | `loanReadiness.engine.test.js` | EXISTS |
| P6-XTEN-001 | Repair | `accountingV2.repair.test.js` (anomaly) | PARTIAL |
| REP-001 | Reports | `accountingV2.reports.test.js` | FAILING |
| REP-006 | Reports AR/AP | `accountingV2.reports.test.js` | FAILING |
| REP-025 | Drill-down | `accountingV2.reports.test.js` | FAILING |
| REP-036 | Unclassified BS | `accountingV2.reports.test.js` | FAILING |

---

## GAP-SEC → test mapping (Phase 15/16)

| Gap ID | Planned test file | Workstream | Status |
|---|---|---|---|
| GAP-SEC-001/002/003 | `securityGovernance.session.test.js` | BY / BK | NOT_STARTED |
| GAP-SEC-005/006 | `securityGovernance.sod.test.js` | BX / BJ | NOT_STARTED |
| GAP-SEC-011/012 | `test/qa/middleware-catalogue.test.js` | BZ / BH | NOT_STARTED |
| GAP-SEC-013 | `test/qa/supplier-idor.test.js` | BY / BF | NOT_STARTED |
| GAP-SEC-014 | `accountingV2.postingEngine.test.js` + legacy test | Q | PARTIAL |
| GAP-SEC-015/016 | `test/qa/capital-authz.test.js`, `reversal-authz.test.js` | R / BG | NOT_STARTED |
| GAP-SEC-018/019 | `test/qa/ai-governance.test.js` | BV | NOT_STARTED |
| GAP-SEC-022/023 | `test/qa/webhook-replay.test.js` | BT | NOT_STARTED |
| GAP-SEC-009/010 | `test/qa/upload-gateway.test.js` (planned) | BU | NOT_STARTED |

---

## GAP-QA → test mapping (Phase 16)

| Gap ID | Test target | Status |
|---|---|---|
| GAP-QA-001 | Fix 55 failing cases | IN_PROGRESS |
| GAP-QA-003 | `supplier-idor.test.js` | NOT_STARTED |
| GAP-QA-006–008 | securityGovernance.*.test.js | NOT_STARTED |
| GAP-QA-011 | `accountingV2.reports.test.js` green | IN_PROGRESS |
| GAP-QA-012 | `liability-journal-link.test.js` | NOT_STARTED |
| GAP-QA-024 | 90% THR-007–016 coverage | NOT_STARTED |

---

## ACC-INV / SEC-INV traceability

Full invariant lists: `ACCOUNTING_INVARIANT_CATALOGUE.md`, `SECURITY_INVARIANT_CATALOGUE.md`.

| Catalogue range | Automated today | Target Phase 16 exit |
|---|---|---|
| ACC-INV-001–050 | ~22 ✅, ~15 ⚠️, ~13 🔍/❌ | ≥40 with ✅ |
| SEC-INV-001–035 | ~8 ✅/⚠️, ~27 ❌ | ≥25 with ✅/⚠️ |

---

## THR-007 – THR-016 scenario checklist

| THR | Scenario | Test | Status |
|---|---|---|---|
| THR-007 | Cross-business supplier read | `supplier-idor.test.js` | NOT_STARTED |
| THR-008 | Cross-business GL post | `postingEngine.test.js` | PARTIAL |
| THR-009 | NULL tenant read | audit + migration | AUDIT_ONLY |
| THR-010 | Role escalation | — | NOT_STARTED |
| THR-011 | Unauthorized reversal | `reversal-authz.test.js` | NOT_STARTED |
| THR-012 | Unauthorized capital | `capital-authz.test.js` | NOT_STARTED |
| THR-013 | Middleware bypass | `middleware-catalogue.test.js` | NOT_STARTED |
| THR-014 | V2 prefix gap | `middleware-catalogue.test.js` | NOT_STARTED |
| THR-015 | AUTHZ_AUDIT_MODE prod | env guard test | NOT_STARTED |
| THR-016 | Self-approval | `securityGovernance.sod.test.js` | NOT_STARTED |

**Current coverage of THR-007–016:** ~15% (engine domain only). **Target:** 90% per Phase 16 gate.
