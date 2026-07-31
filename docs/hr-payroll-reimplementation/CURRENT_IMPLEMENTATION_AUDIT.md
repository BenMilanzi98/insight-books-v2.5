# Current Implementation Audit — HR & Payroll

Audited: 2026-07-25  
Scope: all Sidebar HR & Payroll modules, APIs, Prisma models, calc libs, posting adapters, tests.

## Executive verdict

InsightBooks V2 has a **broad HR/Payroll UI and API surface** that appears operational for Malawi PAYE/NPS-oriented monthly payroll. It is **not** production-ready against the master lifecycle (contracts → approved inputs → versioned rules → immutable run → recognition → payment → reconciliation).

**Primary defects:** Float money, no payroll run/component model, weak attendance/leave→pay bridge, unsafe status mutation, incomplete tenant/branch isolation on child tables, and thin automated coverage of posting/idempotency.

## Lifecycle map (as implemented)

```
Employee (flat salary Float)
    → selectedDeductions Json + benefits
    → optional manual OT / allowances in enhanced route
    → calculatePayroll / calculateMalawiPayroll (IEEE float)
    → Payroll row (Pending → processed)
    → postPayrollAccounting / postGlEntry (per employee)
    → payslip / PAYE summary / reversePayroll
```

Missing: contracts, input snapshot, formula version, review SoD, payment batch distinct from recognition, reconciliation centre.

## Module scores (qualitative)

| Module | UI | API | Data model | Calc accuracy | Accounting | Classification |
|--------|----|-----|------------|---------------|------------|----------------|
| Employees | Strong | Broad | Incomplete | N/A | N/A | `EXTEND` |
| Leave | Present | Dual APIs | Partial | Accrual ad-hoc | None | `EXTEND` |
| Attendance | Present | Present | Partial | Hours helpers | None | `REFACTOR` |
| Performance | Present | Present | Partial | N/A | None (correct) | `EXTEND` |
| Payroll | Present | Heavy | Inadequate | Float / order gaps | Partial V2 | `REIMPLEMENT` |
| Benefits | Thin | CRUD | Thin | Weak payroll link | None | `EXTEND` |
| Pension | Present | Settings/clear | Rates only | % of gross | Liability via payroll lines | `EXTEND` |
| Gratuity | Present | Accrue/pay | Thin | Float | Weak journal link | `EXTEND` |
| Advances | Present | CRUD/deduct | Thin FK | Recovery risk | Mixed posting | `EXTEND` / `DUPLICATE_POSTING_RISK` |
| Reports | Present | Several | N/A | Depends on Payroll | Drill-down weak | `EXTEND` |

## Calculation entry points

| Entry | File | Notes |
|-------|------|-------|
| `calculatePayroll` | `lib/payrollCalculations.js` | PAYE + NPS + custom; float; benefits expected post-tax by callers |
| `calculateMalawiPayroll` | `lib/malawiTaxUtils.js` | Basic + OT taxable; allowances after tax |
| `computeMalawiPayeMonthly` | `lib/malawiPAYE.js` | Hardcoded slabs + tenant bands via engine |
| `calculatePayeForTenant` | `lib/payrollEngine/*` | Facade over tax config |
| Enhanced POST | `app/api/payroll/enhanced/route.js` | Creates Payroll + posts GL |
| Preview | `app/api/payroll/calculate`, `employees/calculate-salary` | No GL |

## Accounting entry points

| Entry | File | Notes |
|-------|------|-------|
| `postPayrollAccounting` | `lib/accountingV2/adapters/remainingAdapters.js` | Cutover → PAYROLL_POSTED; sourceId = payrollId |
| Legacy `postGlEntry` | called via `legacyPost` in enhanced | Dual path |
| `reversePayroll` | `lib/transactionReversalService.js` | Reverses GL + advance/gratuity side effects |
| Salary advance create | `app/api/salary-advances/route.js` | Also calls `postPayrollAccounting` (naming collision risk) |
| Mappings | `TenantSettings.payrollAccountMappings` + `lib/payrollEngine/accountMappings.js` | Json map of purposes → account IDs |

## Workers / jobs

**None** for payroll processing or leave accrual. Accrual is `POST /api/leave-balances/calculate` on demand.

## Security hotspots

1. `PATCH /api/payroll/[id]/status` — no `requirePermission`, updates by `id` only (**no tenantId in where**).  
2. Coarse permissions (`hr.view` / `payroll.view`) vs fine-grained matrix in master prompt.  
3. Sensitive bankDetails Json on Employee without dedicated audit/approval path verified.

## What to reuse vs replace

| Reuse | Replace / rebuild |
|-------|-------------------|
| `/hr/*` page shells | Payroll run state machine |
| PAYE summary service/export | Float money columns |
| Tax configuration model | Per-employee-only Payroll as SoT |
| accountMappings resolver | Arbitrary status PATCH |
| reversePayroll patterns | Dual leave API paths |
| malawiPAYE band logic (migrate to Decimal) | Ad-hoc OT without approved timesheet |

## Readiness for Phase 2

**Go** for foundation work after gap-register approval.  
**No-go** for claiming acceptance criteria or production “complete payroll”.
