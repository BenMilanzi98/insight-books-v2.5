# Known Defect Regression Report

| Field | Value |
|---|---|
| Primary test file | `test/qa/regression/defect.regressions.test.js` |
| Catalogue | `docs/quality-assurance/DEFECT_REGRESSION_CATALOGUE.md` |
| Purpose | **Permanent** guards for production-class defects — not exhaustive defect list |

---

## Permanent regression suite

These regressions encode **known historical failure modes** that must never reappear. They are **closed at the regression-test level** when tests pass in CI — production tenant verification may still be **PENDING** (`docs/production-cutover/KNOWN_DEFECT_PRODUCTION_VALIDATION.md`).

---

### REG-CAP-005 / REG-EQT-035 — Owner capital once

**Symptom:** MK1,000,000 capital contribution displayed or posted as MK2,000,000 (double equity credit).

**Test:** Capital journal has exactly one equity credit totaling `1000000.00`; anti-double-count on all 3xxx lines.

**File:** `test/qa/regression/defect.regressions.test.js` — describe `REG-CAP-005 / REG-EQT-035`

**Related:** DEF-R06-001 (report display) may still **FAIL** in `accountingV2.reports.test.js` — separate from this unit regression.

---

### REG-SAL-5200 — Salaries & Wages account

**Symptom:** Payroll debits wrong salary expense account (5301, 5201, 5210 duplicates vs canonical 5200).

**Test:** Payroll journal debit line uses account `5200`; excludes retired duplicate codes.

**File:** same regression file — describe `REG-SAL-5200`

---

### REG-EXP-5000 — Expense hierarchy (5xxx band)

**Symptom:** Expense postings land on revenue (4xxx) or asset (1xxx) accounts.

**Test:** Expense accounts 5100, 5200, 5400, 5500 stay in 5xxx; balanced journals.

**File:** same regression file — describe `REG-EXP-5000`

---

### REG-PLAN-NOGL — Financial planning never posts

**Symptom:** Forecast/planning module creates GL journals or liabilities.

**Test:** `projectThreeStatements()` returns periods but `journals` is undefined.

**Also:** `test/qa/invariants/accounting.invariants.test.js`

**File:** regression file — describe `REG-PLAN-NOGL / REG-LRD-NOGL`

---

### REG-LRD-NOGL — Loan readiness never posts

**Symptom:** Loan assessment creates GL entries or debt liabilities.

**Test:** `runLoanReadinessAssessment` — `assertNeverPostsToGl`; no liability creation.

**Related:** REG-LRD-017 — revenue-only debt capacity flagged INVALID (same file).

**File:** regression file — describe `REG-PLAN-NOGL / REG-LRD-NOGL` and `REG-LRD-017`

---

## Running regressions

```bash
npx vitest run test/qa/regression/defect.regressions.test.js
npx vitest run test/qa/invariants/accounting.invariants.test.js
```

---

## Not covered by this file

- Full defect catalogue (including **FAILING** report and legacy posting tests): `DEFECT_REGRESSION_CATALOGUE.md`
- Phase 1 forensic findings: `docs/accounting-audit/`
- System-wide open items: `SYSTEM_DEFECT_REGISTER.md`

---

## Production validation status

Per `KNOWN_DEFECT_PRODUCTION_VALIDATION.md`: validate REG-CAP-005, REG-SAL-5200, TB-003, ACC-INV-047/048 in production — **_PENDING_**.

Regression tests passing in CI **does not** replace production spot checks before cutover.
