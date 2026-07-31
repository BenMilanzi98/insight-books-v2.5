# Payroll / HR Report Audit

UI: `/hr/reports`, `/hr/payroll/paye-summary` · APIs: `app/api/hr-reports/**`, `payroll/paye-summary/**`

## Available reports (implemented)

| Report | API | Notes |
|--------|-----|-------|
| Payslips | hr-reports/payslips, send-email | |
| Payroll summary | hr-reports/payroll-summary | |
| Employee summary | hr-reports/employee-summary | |
| Department | hr-reports/department | |
| Attendance | hr-reports/attendance | |
| Statutory remittances | hr-reports/statutory-remittances | |
| PAYE summary | payroll/paye-summary + export | Stronger service layer |

## Gaps vs master report list

| Missing / weak | Classification |
|----------------|----------------|
| Full payroll component register | `INCOMPLETE` |
| Journal / GL drill-down from every amount | `INCOMPLETE` |
| Advance aging / gratuity provision reports | Partial at best |
| Reconciliation centre (results ↔ journals ↔ bank) | `INCOMPLETE` |
| Failed query shows false zero | Needs audit per report | `UNSAFE` if present |
| Account code/name on all rows | Incomplete | `EXTEND` |
| Screen vs PDF/XLSX reconciliation tests | Thin | `INCOMPLETE` |
| PAYE Summary hidden from permission-filtered nav | `DISCONNECTED` UX |

## Disposition

| Piece | Classification |
|-------|----------------|
| Report picker UI | `EXTEND` |
| PAYE summary service | `REUSE` |
| Traceability layer | `REIMPLEMENT` |
| Reconciliation reports | `REIMPLEMENT` |
