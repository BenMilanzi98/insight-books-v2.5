# Defect Regression Catalogue

Known production-class defects from Phases 1–14 with **regression test IDs**. Tests marked **FAILING** must pass before defect closed.

---

## Critical financial defects

| Defect ID | Symptom | Root cause class | Regression test ID | File | Status |
|---|---|---|---|---|---|
| DEF-R01-001 | Reports miss legacy header journals | R-01 / JRN-009 | REG-JRN-009-001 | `accountingAudit.test.js` | ✅ |
| DEF-R01-002 | Header row inflates line totals | R-01 | REG-LED-HEADER-001 | `accountingV2.ledger.test.js` | ✅ |
| DEF-R02-001 | Stored balance ≠ journal derived | R-02 / GL-002 | REG-GL-002-001 | `accountingAudit.test.js`, `glReconciliation.test.js` | ✅ |
| DEF-R03-001 | Duplicate event posting | R-03 / JRN-006 | REG-POST-IDEM-001 | `accountingV2.postingEngine.test.js` | ✅ |
| DEF-R04-001 | AR control −15,000 vs subledger | R-04 / AR-001 | REG-AR-001-001 | `verify-accounting-scenario.cjs` | 🔍 CI optional |
| DEF-R05-001 | Liability without journal | R-05 / AP-004 | REG-AP-004-001 | — | ❌ NOT_STARTED |
| DEF-R06-001 | Capital MK1M displayed as MK2M | R-06 / CAP-005 | REG-CAP-MK1M-001 | `accountingV2.reports.test.js` | **FAILING** |
| DEF-R06-002 | Parent+child equity double-count | CAP-002 / TB-003 | REG-TB-003-001 | `accountingAudit.test.js` | ✅ audit |
| DEF-R22-001 | Dual T+J posting double-count | R-22 | REG-POST-DUAL-001 | — | ❌ |
| DEF-R24-001 | Payroll double-post window | R-24 | REG-PAYROLL-DUP-001 | `malawiTaxUtilsPayroll.test.js` | ⚠️ partial |

---

## Security defects

| Defect ID | Finding | Regression test ID | File | Status |
|---|---|---|---|---|
| DEF-SEC-001 | Cross-tenant GL lines | SEC-1 / R-19 | REG-TEN-POST-001 | `accountingV2.postingEngine.test.js` | ✅ V2 |
| DEF-SEC-002 | Supplier IDOR via query tenantId | SEC-2 / R-20 | REG-SEC2-IDOR-001 | `test/qa/supplier-idor.test.js` | ❌ NOT_STARTED |
| DEF-SEC-003 | Open reversal endpoint | SEC-3 / R-21 | REG-SEC3-REV-001 | `test/qa/reversal-authz.test.js` | ❌ NOT_STARTED |
| DEF-SEC-004 | Capital routes session-only | SEC-4 / R-21 | REG-SEC4-CAP-001 | `test/qa/capital-authz.test.js` | ❌ NOT_STARTED |
| DEF-SEC-005 | Cross-tenant journal line (historical) | P6-XTEN-001 | REG-XTEN-001 | `accountingV2.repair.test.js` | ⚠️ domain |

---

## CoA & expense defects

| Defect ID | Finding | Symptom | Regression test ID | File | Status |
|---|---|---|---|---|---|
| DEF-SAL-DUP-001 | SAL-DUP | Multiple salary accounts (5301 vs 5200) | REG-COA-5200-001 | `legacyExpenseAccountRemaps.test.js` | ✅ |
| DEF-SAL-DUP-002 | SAL-DUP | Payroll maps to 5200 | REG-COA-5200-002 | `malawiTaxUtilsPayroll.test.js` | ✅ |
| DEF-5000-001 | 5000 header | IS double-count operating expenses | REG-IS-5000-001 | `incomeStatementOperatingExpenseRollup.test.js` | **FAILING** |
| DEF-TB-003-001 | TB-003 | TB includes header balances | REG-TB-003-002 | `accountingV2.reports.test.js` | **FAILING** |

---

## Equity & loan defects

| Defect ID | Finding | Regression test ID | File | Status |
|---|---|---|---|---|
| DEF-EQT-035-001 | EQT-035 duplicate MK1M capital | REG-EQT-035-001 | `equityManagement.domain.test.js` | ✅ |
| DEF-LRD-017-001 | LRD-017 revenue-only capacity | REG-LRD-CAP-001 | `loanReadiness.engine.test.js` | ✅ |

---

## Legacy engine removal regressions (July 2026)

| Defect ID | Symptom | Regression test ID | File | Status |
|---|---|---|---|---|
| DEF-LEG-POST-001 | Callers expect `postGlEntry` to work | REG-LEG-REMOVED-001 | `accountingEngine.test.js` | **FAILING** (tests expect success) |
| DEF-LEG-POST-002 | Inventory write-off uses legacy | REG-INV-WO-001 | `inventoryWriteOffJournal.test.js` | **FAILING** |
| DEF-LEG-POST-003 | Payroll reversal uses legacy | REG-PAY-REV-001 | `payrollReversalLegacyRoot.test.js` | **FAILING** |

**Remediation:** Update tests to assert `LEGACY_POSTING_REMOVED` or migrate callers to V2 — GAP-QA-013.

---

## Report engine regressions (active)

| Defect ID | Report rule | Regression test ID | Status |
|---|---|---|---|
| DEF-REP-001 | Unbalanced books flagged REP-001 | REG-REP-001-001 | **FAILING** |
| DEF-REP-006 | AR/AP control diff blocks VERIFIED | REG-REP-006-001 | **FAILING** |
| DEF-REP-025 | Drill-down = line total | REG-REP-025-001 | **FAILING** |
| DEF-REP-036 | Unclassified BS disclosure | REG-REP-036-001 | **FAILING** |

All in `accountingV2.reports.test.js` — GAP-QA-011.

---

## Naming convention

```
REG-<DOMAIN>-<SEQ>
  DOMAIN = JRN, GL, AR, SEC2, COA, EQT, REP, ...
```

New regression tests **must** reference DEF-* or finding ID in describe block comment.

---

## Closure workflow

1. Fix production code.
2. Add/update REG-* test.
3. Link in this catalogue.
4. Update `REQUIREMENT_TEST_TRACEABILITY_MATRIX.md`.
5. Close only when CI green (or waived per `TEST_WAIVER_GOVERNANCE.md`).
