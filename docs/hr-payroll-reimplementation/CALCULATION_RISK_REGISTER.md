# Calculation Risk Register

| ID | Risk | Evidence | Severity | Classification |
|----|------|----------|----------|----------------|
| CR-01 | IEEE float drift on money | Float columns + `salary * rate` | Critical | `INCORRECT_CALCULATION` |
| CR-02 | PAYE base ignores employee NPS / pre-tax order | `calculatePayroll` taxable = full gross | High | `INCORRECT_CALCULATION` (policy) |
| CR-03 | Two calculators disagree (basic calc vs Malawi OT/allowances) | payrollCalculations vs malawiTaxUtils | Critical | `DUPLICATED` |
| CR-04 | Hourly pay not derived from approved minutes | Manual OT hours/rate | High | `DISCONNECTED` |
| CR-05 | Proration method not stored | Mid-period hire/term | High | `INCOMPLETE` |
| CR-06 | Benefits after-tax by convention only | Comments in calculatePayroll | Medium | `INCOMPLETE` |
| CR-07 | Deduction priority / min net pay absent | No engine | High | `INCOMPLETE` |
| CR-08 | Negative net pay not gated | netPay = salary - deductions | Medium | `UNSAFE` |
| CR-09 | Formula not versioned | No template table | Critical | `INCOMPLETE` |
| CR-10 | Rounding differs across routes | local roundMoney | Medium | `REFACTOR` → lib/money |
| CR-11 | Name-matching for PAYE/NPS deductions | payrollDeductionMatching | Medium | Fragile `REFACTOR` |
| CR-12 | Employer NPS omitted from employer cost totals in some UIs | Partial fields | Medium | `INCOMPLETE` |

## Required calc invariants (target)

- Money via `lib/money.js` minor units.  
- Time via integer minutes.  
- Ordered components with stored formulaVersion.  
- Explanation string/JSON persisted per employee result.
