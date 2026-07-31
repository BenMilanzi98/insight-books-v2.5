# Payroll Calculation Audit

Primary libs: `lib/payrollCalculations.js`, `lib/malawiTaxUtils.js`, `lib/malawiPAYE.js`, `lib/payrollEngine/**`  
Routes: `/api/payroll/calculate`, `/bulk`, `/enhanced`, `/process`, `employees/calculate-salary`

## Observed formula (current)

### `calculatePayroll(grossSalary, selectedDeductions, options)`

1. Resolve NPS rates via `effectiveNpsRatePercentForPayroll` if NPS deduction selected.  
2. `calculateNPS(gross)` → employee/employer amounts (`salary * rate`).  
3. PAYE on **full gross** (`payeTaxableBase = max(0, salary)`) if PAYE selected — **does not reduce for employee NPS** before tax.  
4. Custom deductions (percentage of gross or fixed).  
5. `netPay = salary - PAYE - employee NPS - custom`.  
6. Employer NPS returned but not deducted from net (correct).

Rounding: `Math.round(n * 100) / 100` and IEEE `*` — **not** `lib/money.js`.

### `calculateMalawiPayroll` (`malawiTaxUtils.js`)

- Taxable base = **basic + overtime** only.  
- Allowances treated as after-tax additions to net (caller-dependent).  
- Journal line builder: `generatePayrollJournalEntries`.

**Classification:** two parallel calculators → `DUPLICATED` / `CONSOLIDATE` into one versioned engine.

## Gaps vs master calculation order

| Required step | Current | Classification |
|---------------|---------|----------------|
| Resolve contract version | Employee flat fields | `INCOMPLETE` |
| Approved attendance hours | Manual OT inputs possible | `DISCONNECTED` |
| Paid/unpaid leave effects | Not systematic | `INCOMPLETE` |
| Benefits/allowances catalogue rules | Partial / after-tax hack | `INCOMPLETE` |
| Pre-tax vs post-tax order | Fixed; NPS not pre-tax for PAYE | `INCORRECT_CALCULATION` (policy TBD) |
| Deduction priority / min net pay | Absent | `INCOMPLETE` |
| Advance recovery as component | Partial via enhanced | `EXTEND` |
| Penalties from disciplinary | Absent | `INCOMPLETE` |
| Formula template version stored | Absent | `INCOMPLETE` |
| Component-level explanation stored | Partial notes / breakdown in memory | `INCOMPLETE` |
| Exact decimal | Float | `INCORRECT_CALCULATION` |
| Hourly / daily / hybrid bases | HourlyRate field only | `INCOMPLETE` |
| Proration methods | Not versioned | `INCOMPLETE` |
| Input snapshot | None | `INCOMPLETE` |

## Determinism / reproducibility

- Same inputs generally reproducible in process memory.  
- No checksum on stored `Payroll` row.  
- Recalculation of posted payroll not hard-blocked at model level (status string).  

## Disposition

| Piece | Classification |
|-------|----------------|
| Malawi PAYE band math | `REUSE` → Decimal |
| NPS % helper | `REUSE` |
| Deduction name matching PAYE/NPS | `REFACTOR` → component codes |
| calculatePayroll / Malawi path | `CONSOLIDATE` + `REIMPLEMENT` |
| Formula admin UI | `REIMPLEMENT` |
| Enhanced route orchestration | `REFACTOR` into command services |
