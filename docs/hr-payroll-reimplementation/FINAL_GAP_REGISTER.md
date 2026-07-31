# Final Gap Register — HR & Payroll

Prioritised gaps from the forensic audit. Severity: Critical / High / Medium / Low.  
Date: 2026-07-25

## Critical

| ID | Gap | Area | Disposition |
|----|-----|------|-------------|
| G-C01 | All HR money stored/calculated as Float | Money | `REIMPLEMENT` Decimal + `lib/money` |
| G-C02 | No PayrollRun / component lines / input snapshot | Data model | `REIMPLEMENT` |
| G-C03 | No versioned employment contracts / compensation history | Employee | `REIMPLEMENT` |
| G-C04 | Dual calculators (calculatePayroll vs Malawi) can diverge | Calculation | `CONSOLIDATE` + `REIMPLEMENT` |
| G-C05 | `PATCH /api/payroll/[id]/status` arbitrary status, no tenant scope | Security | `UNSAFE` → remove/rewrite |
| G-C06 | Duplicate payroll journal on retry / no employee-period uniqueness | Posting | `DUPLICATE_POSTING_RISK` |
| G-C07 | Advance recovery identity weak (payrollId string, no unique) | Advances | `DUPLICATE_POSTING_RISK` |
| G-C08 | Recognition vs payment not cleanly separated | Accounting | `INCORRECT_ACCOUNTING` / `REIMPLEMENT` |

## High

| ID | Gap | Area | Disposition |
|----|-----|------|-------------|
| G-H01 | Attendance/OT not mandatory approved source for pay | Attendance | `DISCONNECTED` → `REIMPLEMENT` bridge |
| G-H02 | Leave accrual non-idempotent / dual leave APIs | Leave | `CONSOLIDATE` + `REIMPLEMENT` |
| G-H03 | Global unique employeeId / department name | Multi-tenant | `CROSS_TENANT_RISK` |
| G-H04 | Child tables missing tenantId (benefits, gratuity payments, advance deductions) | Multi-tenant | `EXTEND` |
| G-H05 | No branch scoping on HR entities | Multi-tenant | `EXTEND` |
| G-H06 | Coarse permissions / no SoD | Security | `EXTEND` matrix |
| G-H07 | Pension/gratuity contribution ledgers incomplete | Statutory | `EXTEND` / `REIMPLEMENT` |
| G-H08 | No deduction priority / min net pay / deferred recovery | Calculation | `REIMPLEMENT` |
| G-H09 | No disciplinary → approved penalty pipeline | HR | `REIMPLEMENT` |
| G-H10 | Benefits lack taxable/pensionable/effective dating | Benefits | `EXTEND` |
| G-H11 | Salary advance create uses payroll posting adapter | Advances | `REFACTOR` |
| G-H12 | Automated test matrix far below acceptance | QA | Build suite |
| G-H13 | Report/GL drill-down & reconciliation centre missing | Reports | `REIMPLEMENT` |
| G-H14 | Dual V2 + legacyPost path | Accounting | `CONSOLIDATE` |

## Medium

| ID | Gap | Disposition |
|----|-----|-------------|
| G-M01 | PAYE Summary missing from permission-filtered nav | `EXTEND` Sidebar |
| G-M02 | `/hr/payroll/create` not consolidated into workbench | `CONSOLIDATE` |
| G-M03 | PerformanceFeedback.reviewId without FK | `EXTEND` |
| G-M04 | Hourly/daily/hybrid pay bases incomplete | `REIMPLEMENT` phased |
| G-M05 | Proration policy not versioned | `REIMPLEMENT` |
| G-M06 | Formula template admin absent | `REIMPLEMENT` |
| G-M07 | HR dashboard KPIs (non-false-zero) | `EXTEND` after engines |
| G-M08 | Import Dry Run / approved-result protection | `EXTEND` |
| G-M09 | Notifications/alerts for payroll exceptions | `EXTEND` |
| G-M10 | Name-based PAYE/NPS deduction matching | `REFACTOR` → codes |

## Low

| ID | Gap | Disposition |
|----|-----|-------------|
| G-L01 | `/hr` redirect-only hub | Optional dashboard later |
| G-L02 | Admin performance routes name collision (non-HR) | Document / ignore |
| G-L03 | Encashment / TOIL advanced leave features | Later phase |

## Counts (initial)

| Severity | Count |
|----------|-------|
| Critical | 8 |
| High | 14 |
| Medium | 10 |
| Low | 3 |

## Readiness

| Question | Answer |
|----------|--------|
| Phase 1 audit complete? | **Yes** |
| Safe to claim master acceptance? | **No** |
| Safe to start Phase 2 Foundation? | **Yes, after stakeholder approval of this register + REIMPLEMENTATION_PLAN** |
| Blockers before Foundation? | None technical — approval gate only |

## Suggested first code slice (post-approval)

1. Fix/remove payroll status PATCH (SEC-01 / G-C05).  
2. Add tenantId to vulnerable mutations.  
3. Plan Decimal migration for Payroll/Employee money fields.  
4. Introduce PayrollRun skeleton without cutting over UI yet.
