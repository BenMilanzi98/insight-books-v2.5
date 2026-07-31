# Route and Component Inventory

Audited: 2026-07-25  
Sources: `components/Sidebar/Sidebar.js`, `app/hr/**`, `components/hr/**`, `app/api/**`

## Navigation

**Location:** Main tenant Sidebar → Additional Features → **HR & Payroll**  
**AdminSidebar:** no HR links.

| Menu text | href | Permission(s) | Notes |
|-----------|------|---------------|-------|
| Employee Management | `/hr/employees` | `hr.view` | |
| Leave Management | `/hr/leave` | `leave.view`, `leave.create`, `hr.view` | |
| Attendance Tracking | `/hr/attendance` | `hr.view` | |
| Performance Management | `/hr/performance` | `hr.view` | |
| Payroll Processing | `/hr/payroll` | `payroll.view`, `hr.view` | |
| PAYE Summary | `/hr/payroll/paye-summary` | (static nav only) | **Missing** from permission-filtered `hrSubItems` |
| Benefits & Allowances | `/hr/benefits` | `hr.view` | |
| Pension (NPS) | `/hr/pension` | `payroll.view`, `hr.view` | |
| Gratuity Management | `/hr/gratuity` | `payroll.view`, `hr.view` | |
| Salary Advances | `/hr/advances` | `payroll.view`, `hr.view` | Path alias (not `/salary-advances`) |
| HR Reports | `/hr/reports` | `hr.view`, `reports.view` | Path alias (not `/hr-reports`) |

**Classification:** Nav shell `REUSE`; PAYE Summary visibility bug `EXTEND` fix.

## UI pages

| Route | File | ~LOC | Maturity | Classification |
|-------|------|------|----------|----------------|
| `/hr` | `app/hr/page.js` | ~24 | Redirect stub → employees | `REUSE` |
| `/hr/employees` | `app/hr/employees/page.js` | ~3.7k | Full CRUD UI | `EXTEND` (contracts/comp history) |
| `/hr/leave` | `app/hr/leave/page.js` | ~930 | Policies + requests | `EXTEND` |
| `/hr/attendance` | `app/hr/attendance/page.js` | ~1.3k | Clock, OT, export | `REFACTOR` / `EXTEND` |
| `/hr/performance` | `app/hr/performance/page.js` | ~1.3k | Reviews/goals/feedback | `EXTEND` |
| `/hr/payroll` | `app/hr/payroll/page.js` | ~1.6k | Process/reverse/payslips | `REIMPLEMENT` lifecycle |
| `/hr/payroll/create` | `app/hr/payroll/create/page.js` | ~460 | Manual calc; not in sidebar | `CONSOLIDATE` into run workbench |
| `/hr/payroll/paye-summary` | `app/hr/payroll/paye-summary/page.js` + `components/hr/PayeSummaryClient.jsx` | ~620 | Filters/export | `REUSE` / `EXTEND` |
| `/hr/benefits` | `app/hr/benefits/page.js` | ~360 | Catalogue CRUD | `EXTEND` |
| `/hr/pension` | `app/hr/pension/page.js` | ~650 | Rates + clear | `EXTEND` |
| `/hr/gratuity` | `app/hr/gratuity/page.js` | ~650 | Accrual + payments | `EXTEND` |
| `/hr/advances` | `app/hr/advances/page.js` | ~735 | Advances CRUD | `EXTEND` |
| `/hr/reports` | `app/hr/reports/page.js` | ~1.4k | Report picker | `EXTEND` |

**Layout:** `app/hr/layout.js` — shared HR shell.

## API inventory (by domain)

### Employees — `app/api/employees/`

| Path | Role |
|------|------|
| `GET/POST /api/employees` | List / create |
| `GET/PUT/DELETE /api/employees/[id]` | Detail |
| `…/terminate`, `suspend`, `reactivate` | Lifecycle |
| `…/benefits` | Assign benefits |
| `calculate-salary` | Preview via `calculatePayroll` |
| `bulk-apply-paye`, `bulk-delete` | Bulk ops |
| `export`, `import`, `import-template` | I/O |
| `upload-photo`, `upload-document`, photo/document GETs | Attachments |

### Leave

| Path | Role |
|------|------|
| `/api/leave`, `/api/leave/[id]`, approve, reject | Requests (legacy path) |
| `/api/leave-requests/**` | Parallel request API |
| `/api/leave-policies/**` | Policies |
| `/api/leave-balances`, `/api/leave-balances/calculate` | Balances; **on-demand accrual** |

### Attendance

| Path | Role |
|------|------|
| `/api/attendance`, `[id]`, clock-in, clock-out | Capture |
| `/api/attendance/finalize/**` | Daily register finalize |
| `/api/attendance/report/list`, `absences/bulk`, `bulk-delete` | Reports / bulk |
| `/api/attendance-policies` | Policies |

### Payroll — `app/api/payroll/`

| Path | Role | Risk |
|------|------|------|
| `GET/POST /api/payroll` | List / create | Calc via `calculatePayroll` |
| `/api/payroll/calculate` | Preview | |
| `/api/payroll/bulk` | Bulk create | |
| `/api/payroll/enhanced` | **Main Malawi calc + GL post** | Dual legacy/V2 |
| `/api/payroll/process`, `[id]/process` | Process | |
| `/api/payroll/[id]`, details, payslip | Detail | |
| `/api/payroll/[id]/status` | **Arbitrary PATCH status** | `UNSAFE` |
| `/api/payroll/reverse`, `remove-entries` | Reversal | |
| `tax-configuration`, `account-mappings` | Config | |
| `paye-summary`, export | Statutory | |
| `payslips`, `send-payslips` | Payslips | Must not post |

### Benefits / deductions / pension / gratuity / advances

| Prefix | Notes |
|--------|-------|
| `/api/benefits/**` | Catalogue |
| `/api/deductions/**` | Catalogue (assignment via Employee JSON) |
| `/api/pension`, `settings`, `clear` | NPS |
| `/api/gratuity/**`, `payments` | Gratuity |
| `/api/salary-advances/**`, `deductions` | Advances; create may call `postPayrollAccounting` |

### Performance

| Prefix | Notes |
|--------|-------|
| `/api/performance/statistics` | Stats |
| `/api/performance-reviews/**` | Reviews |
| `/api/performance-goals/**` | Goals |
| `/api/performance-feedback/**` | Feedback |

### HR reports — `app/api/hr-reports/`

`payslips`, `payslips/send-email`, `payroll-summary`, `employee-summary`, `department`, `attendance`, `statutory-remittances`

## Client services

- `app/services/payrollService.js`
- `app/services/leaveService.js`
- `app/services/employeeService.js`

## Gaps vs inventory expectations

| Expected | Found | Classification |
|----------|-------|----------------|
| Employment contract UI | Absent | `INCOMPLETE` |
| Shift / timesheet UI | Absent | `INCOMPLETE` |
| Disciplinary workflow UI | Absent | `INCOMPLETE` |
| Payroll Review Workbench | Partial on `/hr/payroll` | `REIMPLEMENT` |
| Reconciliation centre | Absent | `INCOMPLETE` |
| Formula template admin | Absent | `INCOMPLETE` |
| HR dashboard (reconciled KPIs) | Hub redirect only | `INCOMPLETE` |

## Disposition summary

- **REUSE:** page shells, PAYE summary client, most list/CRUD UX patterns  
- **EXTEND:** employees, leave, benefits, pension, gratuity, advances, reports  
- **REIMPLEMENT:** payroll run lifecycle, calculation explanation, posting commands  
- **UNSAFE:** payroll status PATCH  
- **CONSOLIDATE:** `/hr/payroll/create` into single run workbench  
- **DISCONNECTED:** dual leave APIs (`/api/leave` vs `/api/leave-requests`)
