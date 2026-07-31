# Test Coverage Audit

## Existing tests (HR/Payroll related)

| File | Covers | Gap |
|------|--------|-----|
| `test/hrCalculations.test.js` | Leave days / attendance hours helpers | Not payroll money |
| `test/malawiPAYE.test.js` | PAYE slabs | Float; not tenant bands full path |
| `test/malawiTaxUtilsPayroll.test.js` | Malawi payroll util | Partial |
| `test/malawiTaxCatalog.test.js` | Tax catalog | Adjacent |
| `test/payeSummaryService.test.js` | PAYE summary | Good reuse |
| `test/payeExpenseSettlement.test.js` | PAYE expense settlement | Adjacent |
| `test/payrollMonthPeriod.test.js` | Period helpers | Thin |
| `test/payrollReversalLegacyRoot.test.js` | Reversal legacy root | Partial |
| `test/salaryAdvanceGlAccount.test.js` | Advance receivable CoA | Good |

**Not found:** leave accrual idempotency, attendance→pay, formula engine, posting idempotency, advance recovery uniqueness, multi-tenant IDOR suite, payslip non-posting, E2E scenarios 1–10.

## Coverage vs required matrix (master §59)

| Area | Status |
|------|--------|
| Employees / contracts | Missing contracts |
| Leave | Helpers only |
| Attendance / OT / hourly | Helpers only |
| Benefits / deductions / penalties | Missing |
| Pension / gratuity / advances | Partial advance CoA |
| Payroll calc / formula / snapshot | Thin util tests |
| Posting / payment / reversal | Partial reversal |
| Reports reconciliation | Missing |
| Multi-tenant / security | Missing |
| UI a11y / responsive | Missing |

## Disposition

| Item | Classification |
|------|----------------|
| Existing PAYE/NPS util tests | `REUSE` / migrate to Decimal |
| hrCalculations tests | `REUSE` |
| Full matrix | `REIMPLEMENT` (build) |

**Initial automated coverage estimate for master acceptance:** **far below** production bar — treat as Critical programme gap (G-H-TEST).
